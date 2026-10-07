import type { Product, ProductColor, ProductCategory } from "@/app/data/productTypes";
import {
  getProductSizes,
  variantKey,
  colorKey,
  slugify,
} from "@/app/data/productTypes";
import {
  getProducts,
  upsertProduct,
  generateProductId,
} from "@/app/lib/dataStore";
import {
  sanitizeColorImages,
  sanitizeVariantStock,
  sumStock,
} from "@/app/lib/productInput";
import {
  validateProductPricing,
  validateInventoryValue,
} from "@/app/lib/priceValidation";

type SpreadsheetRow = Record<string, unknown>;

type ProductRow = {
  productId?: unknown;
  id?: unknown;
  name?: unknown;
  slug?: unknown;
  price?: unknown;
  discount?: unknown;
  discountPercent?: unknown;
  compareAtPrice?: unknown;
  category?: unknown;
  description?: unknown;
  details?: unknown;
  colors?: unknown;
  sizes?: unknown;
  dropLabel?: unknown;
  isNew?: unknown;
};

type VariantRow = {
  productId?: unknown;
  id?: unknown;
  color?: unknown;
  colorHex?: unknown;
  hex?: unknown;
  size?: unknown;
  inventory?: unknown;
  stock?: unknown;
  images?: unknown;
};

export type BulkImportResult = {
  imported: number;
  products: Product[];
  errors: string[];
};

const VALID_CATEGORIES: ProductCategory[] = [
  "t-shirts",
  "hoodies",
  "pants",
  "jackets",
  "accessories",
];

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function numberValue(value: unknown): number | undefined {
  if (value === undefined || value === null || text(value) === "") {
    return undefined;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : undefined;
}

function integerValue(value: unknown): number | undefined {
  const number = numberValue(value);

  if (number === undefined || !Number.isInteger(number)) {
    return undefined;
  }

  return number;
}

function booleanValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;

  const normalized = text(value).toLowerCase();

  return (
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "1" ||
    normalized === "y"
  );
}

function splitValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => text(item))
      .filter(Boolean);
  }

  return text(value)
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeHeader(value: unknown): string {
  return text(value)
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function getValue(
  row: SpreadsheetRow,
  ...names: string[]
): unknown {
  const normalized = new Map<string, unknown>();

  for (const [key, value] of Object.entries(row)) {
    normalized.set(normalizeHeader(key), value);
  }

  for (const name of names) {
    const value = normalized.get(normalizeHeader(name));

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

/**
 * Supports colour definitions such as:
 *
 * Void Black:#0a0a0a|Bone:#e8e3d8
 *
 * It also supports:
 *
 * Void Black,#0a0a0a|Bone,#e8e3d8
 */
function parseProductColors(value: unknown): ProductColor[] {
  const values = splitValues(value);
  const colors: ProductColor[] = [];

  for (const item of values) {
    const separatorIndex = item.indexOf(":");

    const commaIndex = item.indexOf(",");

    const index =
      separatorIndex >= 0
        ? separatorIndex
        : commaIndex >= 0
          ? commaIndex
          : -1;

    if (index === -1) {
      continue;
    }

    const name = item.slice(0, index).trim();
    const hex = item.slice(index + 1).trim();

    if (!name || !hex) continue;

    if (!/^#[0-9a-f]{3,8}$/i.test(hex)) {
      continue;
    }

    colors.push({
      name,
      hex,
    });
  }

  return colors;
}

/**
 * Builds colours from the Variants sheet.
 *
 * Example:
 *
 * color = Void Black
 * colorHex = #0a0a0a
 */
function parseVariantColors(rows: SpreadsheetRow[]): ProductColor[] {
  const colors = new Map<string, ProductColor>();

  for (const row of rows) {
    const name = text(
      getValue(row, "color", "colour", "colorName", "colourName")
    );

    if (!name) continue;

    const hex = text(
      getValue(row, "colorHex", "colourHex", "hex", "colorCode", "colourCode")
    );

    if (!hex || !/^#[0-9a-f]{3,8}$/i.test(hex)) {
      continue;
    }

    const key = colorKey(name);

    if (!colors.has(key)) {
      colors.set(key, {
        name,
        hex,
      });
    }
  }

  return [...colors.values()];
}

function parseDetails(value: unknown): string[] {
  return splitValues(value);
}

function parseImages(value: unknown): string[] {
  return splitValues(value).filter(
    (url) =>
      /^https?:\/\//i.test(url) ||
      url.startsWith("/")
  );
}

function getProductIdentifier(row: SpreadsheetRow): string {
  return text(
    getValue(
      row,
      "productId",
      "productID",
      "product",
      "id"
    )
  );
}

function getVariantIdentifier(row: SpreadsheetRow): string {
  return text(
    getValue(
      row,
      "productId",
      "productID",
      "product",
      "id"
    )
  );
}

function getVariantInventory(row: SpreadsheetRow): number | undefined {
  return integerValue(
    getValue(
      row,
      "inventory",
      "stock",
      "quantity",
      "qty"
    )
  );
}

function makeUniqueSlug(
  baseValue: string,
  existing: Product[],
  reservedSlugs: Set<string>
): string {
  const base = slugify(baseValue) || "product";

  let slug = base;
  let number = 2;

  while (
    existing.some((product) => product.slug === slug) ||
    reservedSlugs.has(slug)
  ) {
    slug = `${base}-${number++}`;
  }

  reservedSlugs.add(slug);

  return slug;
}

function makeUniqueProductId(
  requestedId: string,
  existing: Product[],
  reservedIds: Set<string>
): string {
  const existingIds = new Set(existing.map((product) => product.id));

  if (
    requestedId &&
    !existingIds.has(requestedId) &&
    !reservedIds.has(requestedId)
  ) {
    reservedIds.add(requestedId);
    return requestedId;
  }

  let id = generateProductId([
    ...existing,
    ...[...reservedIds].map((id) => ({
      id,
    } as Product)),
  ]);

  while (
    existingIds.has(id) ||
    reservedIds.has(id)
  ) {
    const match = id.match(/^p-(\d+)$/);

    if (match) {
      id = `p-${String(Number(match[1]) + 1).padStart(3, "0")}`;
    } else {
      id = `${id}-2`;
    }
  }

  reservedIds.add(id);

  return id;
}

function normalizeCategory(value: unknown): ProductCategory {
  const category = text(value).toLowerCase();

  if (
    VALID_CATEGORIES.includes(
      category as ProductCategory
    )
  ) {
    return category as ProductCategory;
  }

  return "t-shirts";
}

export async function importProductsFromRows(
  productRows: SpreadsheetRow[],
  variantRows: SpreadsheetRow[]
): Promise<BulkImportResult> {
  const existingProducts = await getProducts();

  const errors: string[] = [];
  const importedProducts: Product[] = [];

  const reservedIds = new Set<string>();
  const reservedSlugs = new Set<string>();

  /**
   * Group all variant rows by product ID.
   */
  const variantsByProduct = new Map<string, SpreadsheetRow[]>();

  for (let index = 0; index < variantRows.length; index++) {
    const row = variantRows[index];
    const productId = getVariantIdentifier(row);

    if (!productId) {
      errors.push(
        `Variants row ${index + 2}: productId is required.`
      );
      continue;
    }

    const rows = variantsByProduct.get(productId) ?? [];
    rows.push(row);
    variantsByProduct.set(productId, rows);
  }

  for (let index = 0; index < productRows.length; index++) {
    const row = productRows[index] as SpreadsheetRow;

    const excelRowNumber = index + 2;

    const productName = text(
      getValue(row, "name", "productName", "title")
    );

    if (!productName) {
      errors.push(
        `Products row ${excelRowNumber}: product name is required.`
      );
      continue;
    }

    const price = numberValue(
      getValue(row, "price", "sellingPrice")
    );

    if (
      price === undefined ||
      price < 0
    ) {
      errors.push(
        `Products row ${excelRowNumber} (${productName}): price must be a valid number greater than or equal to 0.`
      );
      continue;
    }

    const discountRaw = getValue(
      row,
      "discountPercent",
      "discount",
      "discount%"
    );

    const discountPercent =
      discountRaw === undefined ||
      text(discountRaw) === ""
        ? undefined
        : numberValue(discountRaw);

    if (
      discountPercent !== undefined &&
      (discountPercent < 0 ||
        discountPercent > 100)
    ) {
      errors.push(
        `Products row ${excelRowNumber} (${productName}): discount must be between 0 and 100.`
      );
      continue;
    }

    const compareAtPrice = numberValue(
      getValue(
        row,
        "compareAtPrice",
        "comparePrice",
        "mrp"
      )
    );

    if (
      compareAtPrice !== undefined &&
      compareAtPrice < 0
    ) {
      errors.push(
        `Products row ${excelRowNumber} (${productName}): compareAtPrice cannot be negative.`
      );
      continue;
    }

    const requestedProductId = text(
      getValue(
        row,
        "productId",
        "productID",
        "id"
      )
    );

    /**
     * Existing product IDs are not silently overwritten.
     *
     * This importer is intended for bulk creation.
     */
    if (
      requestedProductId &&
      existingProducts.some(
        (product) => product.id === requestedProductId
      )
    ) {
      errors.push(
        `Products row ${excelRowNumber} (${productName}): productId "${requestedProductId}" already exists.`
      );
      continue;
    }

    const productId = makeUniqueProductId(
      requestedProductId,
      existingProducts,
      reservedIds
    );

    const slugInput = text(
      getValue(row, "slug")
    );

    const slug = makeUniqueSlug(
      slugInput || productName,
      existingProducts,
      reservedSlugs
    );

    const productVariantRows =
      variantsByProduct.get(productId) ??
      variantsByProduct.get(requestedProductId) ??
      [];

    /**
     * First try colours from the Products sheet.
     *
     * Format:
     *
     * Void Black:#0a0a0a|Bone:#e8e3d8
     */
    let colors = parseProductColors(
      getValue(
        row,
        "colors",
        "colours",
        "colorDefinitions",
        "colourDefinitions"
      )
    );

    /**
     * If the Products sheet doesn't contain colour definitions,
     * derive them from the Variants sheet.
     */
    if (colors.length === 0) {
      colors = parseVariantColors(
        productVariantRows
      );
    }

    const sizesFromProduct = splitValues(
      getValue(row, "sizes", "size")
    );

    const sizesFromVariants = productVariantRows
      .map((variantRow) =>
        text(
          getValue(
            variantRow,
            "size"
          )
        )
      )
      .filter(Boolean);

    const sizes = [
      ...new Set([
        ...sizesFromProduct,
        ...sizesFromVariants,
      ]),
    ];

    /**
     * If variant rows contain colours that were not listed
     * in Products, add them.
     */
    const variantColors =
      parseVariantColors(
        productVariantRows
      );

    const colorMap = new Map(
      colors.map((color) => [
        colorKey(color.name),
        color,
      ])
    );

    for (const color of variantColors) {
      if (!colorMap.has(colorKey(color.name))) {
        colorMap.set(
          colorKey(color.name),
          color
        );
      }
    }

    colors = [...colorMap.values()];

    if (
      productVariantRows.length > 0 &&
      colors.length === 0
    ) {
      errors.push(
        `Products row ${excelRowNumber} (${productName}): variant rows contain colours, but no valid colour + hex value was found.`
      );
      continue;
    }

    /**
     * Variant stock.
     */
    let variantStockRaw:
      | Record<string, number>
      | undefined;

    if (
      productVariantRows.length > 0
    ) {
      const stockSource: Record<string, number> = {};

      for (
        let variantIndex = 0;
        variantIndex < productVariantRows.length;
        variantIndex++
      ) {
        const variantRow =
          productVariantRows[variantIndex];

        const colorName = text(
          getValue(
            variantRow,
            "color",
            "colour",
            "colorName",
            "colourName"
          )
        );

        const size = text(
          getValue(
            variantRow,
            "size"
          )
        );

        if (!colorName) {
          errors.push(
            `Variants row ${variantIndex + 2} for ${productName}: color is required.`
          );
          continue;
        }

        if (!size) {
          errors.push(
            `Variants row ${variantIndex + 2} for ${productName}: size is required.`
          );
          continue;
        }

        const inventory =
          getVariantInventory(
            variantRow
          );

        if (
          inventory === undefined ||
          inventory < 0 ||
          inventory > 1_000_000
        ) {
          errors.push(
            `Variants row ${variantIndex + 2} for ${productName}: inventory must be a whole number from 0 to 1,000,000.`
          );
          continue;
        }

        /**
         * IMPORTANT:
         *
         * Use the exact same variantKey() used everywhere
         * else in Mangosta.
         */
        stockSource[
          variantKey(colorName, size)
        ] = inventory;
      }

      variantStockRaw = stockSource;
    }

    /**
     * Ensure every colour × size combination exists.
     *
     * Missing cells become 0, matching the existing
     * sanitizeVariantStock() behavior.
     */
    let variantStock:
      | Record<string, number>
      | undefined;

    if (
      variantStockRaw &&
      Object.keys(variantStockRaw).length > 0
    ) {
      const sanitized =
        sanitizeVariantStock(
          variantStockRaw,
          colors,
          sizes
        );

      if (!sanitized) {
        errors.push(
          `Products row ${excelRowNumber} (${productName}): invalid variant inventory.`
        );
        continue;
      }

      variantStock = sanitized;
    }

    /**
     * If no variant rows were supplied, use product-level
     * inventory from the Products sheet.
     */
    let inventory: number;

    if (variantStock) {
      inventory = sumStock(
        variantStock
      );
    } else {
      const productInventory =
        integerValue(
          getValue(
            row,
            "inventory",
            "stock",
            "quantity",
            "qty"
          )
        );

      inventory =
        productInventory ?? 0;
    }

    const inventoryValidation =
      validateInventoryValue(
        inventory
      );

    if (!inventoryValidation.valid) {
      errors.push(
        `Products row ${excelRowNumber} (${productName}): inventory validation failed - ${inventoryValidation.error}`
      );
      continue;
    }

    /**
     * Main product images.
     */
    const images = parseImages(
      getValue(
        row,
        "images",
        "imageUrls",
        "imageURLs"
      )
    );

    /**
     * Colour-specific images from Variants sheet.
     *
     * Every variant row may contain:
     *
     * images:
     * https://.../front.jpg|https://.../back.jpg
     */
    const colorImagesRaw: Record<
      string,
      string[]
    > = {};

    for (const variantRow of productVariantRows) {
      const colorName = text(
        getValue(
          variantRow,
          "color",
          "colour",
          "colorName",
          "colourName"
        )
      );

      if (!colorName) continue;

      const variantImages =
        parseImages(
          getValue(
            variantRow,
            "images",
            "imageUrls",
            "imageURLs"
          )
        );

      if (variantImages.length === 0) {
        continue;
      }

      const key = colorKey(
        colorName
      );

      colorImagesRaw[key] = [
        ...new Set([
          ...(colorImagesRaw[key] ?? []),
          ...variantImages,
        ]),
      ];
    }

    const colorImages =
      sanitizeColorImages(
        colorImagesRaw,
        colors
      );

    const category = normalizeCategory(
      getValue(
        row,
        "category"
      )
    );

    const product: Product = {
      id: productId,
      slug,
      name: productName,
      category,
      price,
      compareAtPrice,
      discountPercent,
      currency: "INR",
      description: text(
        getValue(
          row,
          "description"
        )
      ),
      details: parseDetails(
        getValue(
          row,
          "details",
          "productDetails"
        )
      ),
      colors,
      sizes,
      images,
      dropLabel:
        text(
          getValue(
            row,
            "dropLabel",
            "drop"
          )
        ) || undefined,
      isNew: booleanValue(
        getValue(
          row,
          "isNew",
          "new"
        )
      ),
      inventory,
      variantStock,
      colorImages,
    };

    /**
     * Remove optional properties that should not be
     * persisted when they aren't actually present.
     */
    if (
      product.compareAtPrice === undefined
    ) {
      delete product.compareAtPrice;
    }

    if (
      product.discountPercent === undefined
    ) {
      delete product.discountPercent;
    }

    if (
      product.dropLabel === undefined
    ) {
      delete product.dropLabel;
    }

    if (
      product.variantStock === undefined
    ) {
      delete product.variantStock;
    }

    if (
      product.colorImages === undefined
    ) {
      delete product.colorImages;
    }

    /**
     * Run the same pricing validation used by
     * the normal admin product creation API.
     */
    const pricingValidation =
      validateProductPricing(
        product
      );

    if (!pricingValidation.valid) {
      errors.push(
        `Products row ${excelRowNumber} (${productName}): pricing validation failed - ${pricingValidation.errors.join(
          "; "
        )}`
      );
      continue;
    }

    importedProducts.push(
      product
    );
  }

  /**
   * Do not partially import anything if one or more
   * validation errors exist.
   *
   * This keeps the Excel import atomic from the
   * admin user's perspective.
   */
  if (errors.length > 0) {
    return {
      imported: 0,
      products: existingProducts,
      errors,
    };
  }

  /**
   * Save all validated products.
   */
  let currentProducts =
    existingProducts;

  for (const product of importedProducts) {
    currentProducts =
      await upsertProduct(
        product
      );
  }

  return {
    imported:
      importedProducts.length,
    products:
      currentProducts,
    errors: [],
  };
}