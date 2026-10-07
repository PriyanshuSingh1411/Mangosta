import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/lib/adminAuth";
import { importProductsFromRows } from "@/app/lib/productBulkImport";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

type SpreadsheetRow = Record<string, unknown>;

function normalizeSheetName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function findSheet(
  workbook: XLSX.WorkBook,
  names: string[]
): XLSX.WorkSheet | undefined {
  const wanted = new Set(
    names.map(normalizeSheetName)
  );

  const sheetName = workbook.SheetNames.find(
    (name) =>
      wanted.has(normalizeSheetName(name))
  );

  return sheetName
    ? workbook.Sheets[sheetName]
    : undefined;
}

function sheetToRows(
  sheet: XLSX.WorkSheet | undefined
): SpreadsheetRow[] {
  if (!sheet) return [];

  return XLSX.utils.sheet_to_json<SpreadsheetRow>(
    sheet,
    {
      defval: "",
      raw: true,
    }
  );
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
            "Excel file is required. Please upload an .xlsx or .xls file.",
        },
        { status: 400 }
      );
    }

    const fileName =
      file.name.toLowerCase();

    if (
      !fileName.endsWith(".xlsx") &&
      !fileName.endsWith(".xls")
    ) {
      return NextResponse.json(
        {
          error:
            "Only .xlsx and .xls files are supported.",
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

    let workbook: XLSX.WorkBook;

    try {
      workbook =
        XLSX.read(buffer, {
          type: "buffer",
        });
    } catch {
      return NextResponse.json(
        {
          error:
            "The uploaded file could not be read as an Excel workbook.",
        },
        { status: 400 }
      );
    }

    if (
      !workbook.SheetNames ||
      workbook.SheetNames.length === 0
    ) {
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
            workbook.SheetNames,
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