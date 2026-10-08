import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/lib/adminAuth";
import { importProductsFromRows } from "@/app/lib/productBulkImport";
import readXlsxFile from "read-excel-file/node";

export const runtime = "nodejs";

type SpreadsheetRow = Record<string, unknown>;

/** One sheet of the uploaded workbook: its tab name and its rows of cells. */
type WorkbookSheet = {
  sheet: string;
  data: unknown[][];
};

function normalizeSheetName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function findSheet(
  sheets: WorkbookSheet[],
  names: string[]
): WorkbookSheet | undefined {
  const wanted = new Set(
    names.map(normalizeSheetName)
  );

  return sheets.find(
    (item) =>
      wanted.has(normalizeSheetName(item.sheet))
  );
}

function isBlankCell(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

/**
 * Turns a sheet into one object per row, keyed by the header row —
 * the same shape the importer has always received:
 *
 * - the first non-empty row is the header row
 * - empty cells become "" (never missing)
 * - completely empty rows are skipped
 * - a blank header becomes "__EMPTY", "__EMPTY_1", …
 * - a repeated header becomes "name_1", "name_2", …
 */
function sheetToRows(
  sheet: WorkbookSheet | undefined
): SpreadsheetRow[] {
  const data = sheet?.data ?? [];

  const headerIndex = data.findIndex((row) =>
    row.some((cell) => !isBlankCell(cell))
  );

  if (headerIndex === -1) return [];

  const width = data.reduce(
    (max, row) => Math.max(max, row.length),
    0
  );

  // Skip empty columns on the left, so column positions match the data.
  let firstColumn = 0;

  while (
    firstColumn < width &&
    data.every((row) => isBlankCell(row[firstColumn]))
  ) {
    firstColumn += 1;
  }

  const headerRow = data[headerIndex];
  const seen = new Map<string, number>();
  const keys: string[] = [];

  for (let column = firstColumn; column < width; column += 1) {
    const cell = headerRow[column];
    const base = isBlankCell(cell)
      ? "__EMPTY"
      : String(cell).trim();

    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    keys.push(count === 0 ? base : `${base}_${count}`);
  }

  const rows: SpreadsheetRow[] = [];

  for (let index = headerIndex + 1; index < data.length; index += 1) {
    const row = data[index];

    if (row.every((cell) => isBlankCell(cell))) continue;

    const record: SpreadsheetRow = {};

    keys.forEach((key, offset) => {
      const cell = row[firstColumn + offset];
      record[key] = isBlankCell(cell) ? "" : cell;
    });

    rows.push(record);
  }

  return rows;
}

export async function POST(
  req: NextRequest
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const formData =
      await req.formData();

    const file =
      formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            "Excel file is required. Please upload an .xlsx file.",
        },
        { status: 400 }
      );
    }

    const fileName =
      file.name.toLowerCase();

    if (!fileName.endsWith(".xlsx")) {
      return NextResponse.json(
        {
          error: fileName.endsWith(".xls")
            ? "Old .xls files are not supported. In Excel, use File → Save As → Excel Workbook (.xlsx) and upload that file."
            : "Only .xlsx files are supported.",
        },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        {
          error:
            "The uploaded Excel file is empty.",
        },
        { status: 400 }
      );
    }

    /**
     * Prevent unexpectedly large uploads.
     *
     * 10 MB is more than enough for a product
     * catalogue containing 50+ products because
     * the spreadsheet contains image URLs rather
     * than the actual image files.
     */
    const MAX_FILE_SIZE =
      10 * 1024 * 1024;

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error:
            "Excel file is too large. Maximum size is 10 MB.",
        },
        { status: 400 }
      );
    }

    const buffer =
      Buffer.from(
        await file.arrayBuffer()
      );

    let workbook: WorkbookSheet[];

    try {
      workbook =
        (await readXlsxFile(buffer)) as WorkbookSheet[];
    } catch {
      return NextResponse.json(
        {
          error:
            "The uploaded file could not be read as an Excel workbook.",
        },
        { status: 400 }
      );
    }

    if (workbook.length === 0) {
      return NextResponse.json(
        {
          error:
            "The Excel workbook does not contain any sheets.",
        },
        { status: 400 }
      );
    }

    /**
     * Required sheet:
     *
     * Products
     *
     * Accepted variations:
     * products
     * Product
     * product_data
     */
    const productsSheet =
      findSheet(
        workbook,
        [
          "Products",
          "Product",
          "Product Data",
          "Products Data",
        ]
      );

    if (!productsSheet) {
      return NextResponse.json(
        {
          error:
            'Missing "Products" sheet. Your workbook must contain a sheet named "Products".',
          availableSheets:
            workbook.map((item) => item.sheet),
        },
        { status: 400 }
      );
    }

    /**
     * Variants is optional.
     *
     * If it exists, inventory is imported
     * per colour + size.
     *
     * If it doesn't exist, the importer uses
     * product-level inventory from Products.
     */
    const variantsSheet =
      findSheet(
        workbook,
        [
          "Variants",
          "Variant",
          "Product Variants",
          "Product Variants Data",
        ]
      );

    const productRows =
      sheetToRows(
        productsSheet
      );

    const variantRows =
      sheetToRows(
        variantsSheet
      );

    if (productRows.length === 0) {
      return NextResponse.json(
        {
          error:
            'The "Products" sheet does not contain any product rows.',
        },
        { status: 400 }
      );
    }

    /**
     * Safety limit.
     *
     * 5,000 products is far above the requested
     * 50+ products but prevents accidentally
     * uploading an enormous spreadsheet.
     */
    if (productRows.length > 5000) {
      return NextResponse.json(
        {
          error:
            "The workbook contains more than 5,000 product rows. Please split the import into smaller files.",
        },
        { status: 400 }
      );
    }

    if (variantRows.length > 50000) {
      return NextResponse.json(
        {
          error:
            "The workbook contains more than 50,000 variant rows. Please split the import into smaller files.",
        },
        { status: 400 }
      );
    }

    const result =
      await importProductsFromRows(
        productRows,
        variantRows
      );

    /**
     * The importer is atomic:
     *
     * if validation errors exist, no products
     * are inserted.
     */
    if (result.errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          imported: 0,
          errors: result.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        imported: result.imported,
        products: result.products,
        message: `${result.imported} product${
          result.imported === 1
            ? ""
            : "s"
        } imported successfully.`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Bulk product import failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to import products.",
      },
      { status: 500 }
    );
  }
}