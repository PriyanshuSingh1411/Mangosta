"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Product,
  ProductCategory,
  ProductColor,
} from "@/app/data/productTypes";
import {
  colorKey,
  formatPrice,
  getProductSalePrice,
  getProductStrikethroughPrice,
  hasVariantStock,
  ONE_SIZE,
  variantKey,
} from "@/app/data/productTypes";

type PickerProduct = Pick<Product, "id" | "name" | "category" | "images">;

/** Size list as typed in the form ("XS, S, M"); ONE SIZE when empty. */
function parseSizes(value: string): string[] {
  const sizes = value
    .split(",")
    .map((size) => size.trim())
    .filter(Boolean);
  return sizes.length > 0 ? sizes : [ONE_SIZE];
}

const CATEGORIES: ProductCategory[] = [
  "t-shirts",
  "hoodies",
  "pants",
  "jackets",
  "accessories",
];

/**
 * Convert a standard CSS color name into a HEX value.
 *
 * Examples:
 * Green  -> #008000
 * Red    -> #ff0000
 * Blue   -> #0000ff
 * White  -> #ffffff
 */
function colorNameToHex(colorName: string): string | null {
  const name = colorName.trim();

  if (!name) {
    return null;
  }

  const element = document.createElement("div");

  element.style.color = name;

  // If browser doesn't recognize the color
  if (!element.style.color) {
    return null;
  }

  document.body.appendChild(element);

  const computedColor = window.getComputedStyle(element).color;

  document.body.removeChild(element);

  const rgb = computedColor.match(
    /^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/
  );

  if (!rgb) {
    return null;
  }

  const [, r, g, b] = rgb;

  return `#${[r, g, b]
    .map((value) =>
      Number(value)
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
}

type FormState = {
  name: string;
  slug: string;
  category: ProductCategory;
  price: string;
  compareAtPrice: string;
  discountPercent: string;
  description: string;
  details: string;
  colors: ProductColor[];
  sizes: string;
  images: string;
  dropLabel: string;
  isNew: boolean;
  inventory: string;
  /** Stock is kept per size & colour (grid) instead of one number. */
  trackVariants: boolean;
  /** variantKey(color, size) → typed stock. */
  variantStock: Record<string, string>;
  /** colorKey(color) → photos (1st = front, 2nd = back). */
  colorImages: Record<string, string[]>;
  completeTheLook: string[];
};

function productToForm(product?: Product): FormState {
  if (!product) {
    return {
      name: "",
      slug: "",
      category: "t-shirts",
      price: "",
      compareAtPrice: "",
      discountPercent: "",
      description: "",
      details: "",
      colors: [],
      sizes: "XS, S, M, L, XL, XXL",
      images: "",
      dropLabel: "",
      isNew: false,
      inventory: "0",
      trackVariants: true,
      variantStock: {},
      colorImages: {},
      completeTheLook: [],
    };
  }

  return {
    name: product.name,
    slug: product.slug,
    category: product.category,
    price: String(product.price),
    compareAtPrice: product.compareAtPrice
      ? String(product.compareAtPrice)
      : "",
    discountPercent:
      product.discountPercent != null
        ? String(product.discountPercent)
        : "",
    description: product.description,
    details: product.details.join("\n"),
    colors:
      product.colors.length > 0
        ? product.colors
        : [
            {
              name: "Void Black",
              hex: "#0a0a0a",
            },
          ],
    sizes: product.sizes.join(", "),
    images: product.images.join("\n"),
    dropLabel: product.dropLabel || "",
    isNew: Boolean(product.isNew),
    inventory: String(product.inventory),
    trackVariants: hasVariantStock(product),
    variantStock: Object.fromEntries(
      Object.entries(product.variantStock ?? {}).map(([key, value]) => [key, String(value)])
    ),
    colorImages: product.colorImages ?? {},
    completeTheLook: product.completeTheLook ?? [],
  };
}

export default function ProductForm({
  product,
}: {
  product?: Product;
}) {
  const router = useRouter();
  const isEditing = Boolean(product);

  const [form, setForm] = useState<FormState>(() =>
    productToForm(product)
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stock value this form was loaded with. Sent on save so the server only
  // writes stock when the admin actually changed it, and never overwrites
  // orders placed while this form was open.
  const inventoryOnLoadRef = useRef<number | undefined>(
    product?.inventory
  );
  const variantStockOnLoadRef = useRef<Record<string, number> | undefined>(
    product?.variantStock
  );

  const [allProducts, setAllProducts] = useState<PickerProduct[]>([]);
  const [colorUploading, setColorUploading] = useState<string | null>(null);

  // Products for "Complete the look".
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/products", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (!cancelled) setAllProducts(Array.isArray(data) ? data : []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const update = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateColor = (
    index: number,
    key: keyof ProductColor,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      colors: current.colors.map((color, i) =>
        i === index
          ? {
              ...color,
              [key]: value,
            }
          : color
      ),
    }));
  };

  /**
   * Update color name and automatically resolve
   * the corresponding HEX value.
   */
  const updateColorName = (
    index: number,
    name: string
  ) => {
    setForm((current) => {
      const previousName = current.colors[index]?.name ?? "";

      // Keep this colour's photos and stock when it is renamed.
      const colorImages = { ...current.colorImages };
      const oldKey = colorKey(previousName);
      const newKey = colorKey(name);
      if (oldKey !== newKey && colorImages[oldKey]) {
        colorImages[newKey] = colorImages[oldKey];
        delete colorImages[oldKey];
      }

      const variantStock = { ...current.variantStock };
      for (const size of parseSizes(current.sizes)) {
        const from = variantKey(previousName, size);
        const to = variantKey(name, size);
        if (from !== to && variantStock[from] !== undefined) {
          variantStock[to] = variantStock[from];
          delete variantStock[from];
        }
      }

      return {
        ...current,
        colorImages,
        variantStock,
        colors: current.colors.map((color, i) => {
          if (i !== index) {
            return color;
          }

          const hex = colorNameToHex(name);

          return {
            ...color,
            name,
            ...(hex ? { hex } : {}),
          };
        }),
      };
    });
  };

  const setVariantStock = (key: string, value: string) => {
    setForm((current) => ({
      ...current,
      variantStock: {
        ...current.variantStock,
        [key]: value.replace(/[^\d]/g, ""),
      },
    }));
  };

  const setColorImages = (key: string, images: string[]) => {
    setForm((current) => ({
      ...current,
      colorImages: { ...current.colorImages, [key]: images },
    }));
  };

  /** Upload photos for one colour (appended; 1st = front, 2nd = back). */
  const handleColorImageUpload = async (key: string, fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;

    setError(null);
    setColorUploading(key);

    try {
      const uploaded: string[] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} is larger than 10 MB.`);

        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/admin/upload", { method: "POST", body: formData });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.url) throw new Error(data.error || `Failed to upload ${file.name}.`);
        uploaded.push(data.url);
      }

      setForm((current) => ({
        ...current,
        colorImages: {
          ...current.colorImages,
          [key]: [...(current.colorImages[key] ?? []), ...uploaded].slice(0, 8),
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setColorUploading(null);
    }
  };

  const addColor = () => {
    setForm((current) => ({
      ...current,
      colors: [
        ...current.colors,
        {
          name: "",
          hex: "",
        },
      ],
    }));
  };

  const removeColor = (index: number) => {
    setForm((current) => ({
      ...current,
      colors: current.colors.filter(
        (_, i) => i !== index
      ),
    }));
  };

  /**
   * Upload one or multiple images to Cloudinary.
   */
  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const uploadedUrls: string[] = [];

      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          throw new Error(
            `${file.name} is not an image.`
          );
        }

        if (file.size > 10 * 1024 * 1024) {
          throw new Error(
            `${file.name} is larger than 10 MB.`
          );
        }

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(
          "/api/admin/upload",
          {
            method: "POST",
            body: formData,
          }
        );

        const data = await response
          .json()
          .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.error ||
              `Failed to upload ${file.name}.`
          );
        }

        if (data.url) {
          uploadedUrls.push(data.url);
        }
      }

      setForm((current) => ({
        ...current,
        images: [
          ...current.images
            .split("\n")
            .map((url) => url.trim())
            .filter(Boolean),
          ...uploadedUrls,
        ].join("\n"),
      }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to upload image."
      );
    } finally {
      setIsUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }

    if (
      form.colors.some(
        (color) =>
          !color.name.trim() ||
          !color.hex.trim()
      )
    ) {
      setError(
        "Every color needs a name and a hex value."
      );
      return;
    }

    if (
      form.colors.some(
        (color) =>
          !/^#[0-9a-f]{6}$/i.test(
            color.hex.trim()
          )
      )
    ) {
      setError(
        "Every color must have a valid 6-digit HEX value."
      );
      return;
    }

    const sizesList = parseSizes(form.sizes);
    const colorNames = form.colors.length > 0 ? form.colors.map((color) => color.name.trim()) : [""];
    const variantStockPayload: Record<string, number> = {};
    for (const colorName of colorNames) {
      for (const size of sizesList) {
        const key = variantKey(colorName, size);
        variantStockPayload[key] = parseInt(form.variantStock[key] ?? "0", 10) || 0;
      }
    }

    const colorImagesPayload: Record<string, string[]> = {};
    for (const color of form.colors) {
      const list = form.colorImages[colorKey(color.name)] ?? [];
      if (list.length > 0) colorImagesPayload[colorKey(color.name.trim())] = list;
    }

    setIsSaving(true);

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      category: form.category,
      price: parseFloat(form.price) || 0,

      compareAtPrice: form.compareAtPrice
        ? parseFloat(form.compareAtPrice)
        : undefined,

      discountPercent:
        form.discountPercent === ""
          ? undefined
          : Math.min(
              100,
              Math.max(0, parseFloat(form.discountPercent) || 0)
            ),

      description: form.description.trim(),

      details: form.details
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),

      colors: form.colors.map((color) => ({
        name: color.name.trim(),
        hex: color.hex.trim(),
      })),

      sizes: form.sizes
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),

      images: form.images
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),

      dropLabel:
        form.dropLabel.trim() || undefined,

      isNew: form.isNew,

      inventory: form.trackVariants
        ? Object.values(variantStockPayload).reduce((sum, value) => sum + value, 0)
        : parseInt(form.inventory, 10) || 0,

      stockMode: form.trackVariants ? "variants" : "total",

      ...(form.trackVariants
        ? { variantStock: variantStockPayload }
        : {}),

      colorImages: colorImagesPayload,

      completeTheLook: form.completeTheLook,

      ...(isEditing
        ? {
            inventoryOnLoad: inventoryOnLoadRef.current,
            variantStockOnLoad: variantStockOnLoadRef.current ?? null,
          }
        : {}),
    };

    try {
      const url = isEditing
        ? `/api/admin/products/${product!.id}`
        : "/api/admin/products";

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({}));

        // Orders changed the stock while this form was open: remember the
        // current value so the next save compares against it.
        if (
          response.status === 409 &&
          typeof data.currentInventory === "number"
        ) {
          inventoryOnLoadRef.current = data.currentInventory;
          variantStockOnLoadRef.current = data.currentVariantStock ?? undefined;
        }

        throw new Error(
          data.error ||
            "Failed to save product."
        );
      }

      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Preview uses the same price helpers as the storefront, so the admin
  // sees exactly what customers will see (incl. compare-at price).
  const previewPricing = {
    price: parseFloat(form.price) || 0,
    compareAtPrice: parseFloat(form.compareAtPrice) || undefined,
    discountPercent: Math.min(
      100,
      Math.max(0, parseFloat(form.discountPercent) || 0)
    ),
  };
  const previewWasPrice = getProductStrikethroughPrice(previewPricing);
  const previewSalePrice = getProductSalePrice(previewPricing);

  const gridSizes = parseSizes(form.sizes);
  const gridColors = form.colors.length > 0 ? form.colors : [{ name: "", hex: "#8c8880" }];
  const gridTotal = gridColors.reduce(
    (sum, color) =>
      sum +
      gridSizes.reduce(
        (inner, size) => inner + (parseInt(form.variantStock[variantKey(color.name, size)] ?? "0", 10) || 0),
        0
      ),
    0
  );
  const lookOptions = allProducts.filter(
    (candidate) => candidate.id !== product?.id && !form.completeTheLook.includes(candidate.id)
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-8"
    >
      {/* =========================================================
          PRODUCT INFORMATION
          ========================================================= */}
      <fieldset className="flex flex-col gap-4">
        <legend className="label-technical mb-2">
          PRODUCT INFORMATION
        </legend>

        <Field label="Name">
          <input
            required
            value={form.name}
            onChange={(e) =>
              update("name", e.target.value)
            }
            className={inputClass}
            placeholder="Mangosta Oversized Tee"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Slug">
            <input
              value={form.slug}
              onChange={(e) =>
                update("slug", e.target.value)
              }
              className={inputClass}
              placeholder="mangosta-oversized-tee"
            />
          </Field>

          <Field label="Category">
            <select
              value={form.category}
              onChange={(e) =>
                update(
                  "category",
                  e.target.value as ProductCategory
                )
              }
              className={inputClass}
            >
              {CATEGORIES.map((category) => (
                <option
                  key={category}
                  value={category}
                >
                  {category}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      {/* =========================================================
          IMAGES / CLOUDINARY
          ========================================================= */}
      <fieldset className="flex flex-col gap-4">
        <legend className="label-technical mb-2">
          IMAGES
        </legend>

        <div className="flex flex-col gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={() =>
              fileInputRef.current?.click()
            }
            disabled={isUploading}
            className="border border-line-strong px-4 py-6 text-center text-xs tracking-[0.15em] text-bone-dim transition-colors hover:border-bone hover:text-bone disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading
              ? "UPLOADING…"
              : "CLICK TO UPLOAD PRODUCT IMAGES"}
          </button>

          <p className="text-xs text-stone">
            JPG, PNG, WEBP or GIF. Maximum 10 MB
            per image.
          </p>

          {form.images && (
            <div className="flex flex-col gap-2">
              {form.images
                .split("\n")
                .map((url) => url.trim())
                .filter(Boolean)
                .map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    className="flex items-center gap-3 border border-line-strong p-2"
                  >
                    <img
                      src={url}
                      alt={`Product image ${
                        index + 1
                      }`}
                      className="h-20 w-16 object-cover"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-bone">
                        {index === 0
                          ? "PRIMARY IMAGE"
                          : `IMAGE ${index + 1}`}
                      </p>

                      <p className="truncate text-[10px] text-stone">
                        {url}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const images =
                          form.images
                            .split("\n")
                            .map((image) =>
                              image.trim()
                            )
                            .filter(Boolean);

                        images.splice(index, 1);

                        update(
                          "images",
                          images.join("\n")
                        );
                      }}
                      className="shrink-0 px-2 text-xs text-stone transition-colors hover:text-mango"
                      aria-label={`Remove image ${
                        index + 1
                      }`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
            </div>
          )}

          {!form.images && (
            <p className="text-xs text-stone">
              No images uploaded. The storefront
              will use the generated placeholder
              silhouette.
            </p>
          )}

          {form.images && (
            <p className="text-xs text-stone">
              The first image is used as the primary
              product image.
            </p>
          )}
        </div>
      </fieldset>

      {/* =========================================================
          PRICING & STOCK
          ========================================================= */}
      <fieldset className="flex flex-col gap-4">
        <legend className="label-technical mb-2">
          PRICING &amp; STOCK
        </legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Price (INR)">
            <input
              required
              type="number"
              min="0"
              step="1"
              value={form.price}
              onChange={(e) =>
                update(
                  "price",
                  e.target.value
                )
              }
              className={inputClass}
            />
          </Field>

          <Field label="Compare-at price (optional)">
            <input
              type="number"
              min="0"
              step="1"
              value={form.compareAtPrice}
              onChange={(e) =>
                update(
                  "compareAtPrice",
                  e.target.value
                )
              }
              className={inputClass}
            />
          </Field>

          <Field label="Discount (% OFF)">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.discountPercent}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "") {
                  update("discountPercent", "");
                  return;
                }
                const numericValue = Number(value);
                update(
                  "discountPercent",
                  String(Math.min(100, Math.max(0, numericValue)))
                );
              }}
              className={inputClass}
              placeholder="10"
            />
          </Field>

          {form.trackVariants ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-stone">Inventory (total)</span>
              <p className="border border-line px-3.5 py-2.5 font-mono text-sm text-bone-dim">
                {gridTotal} <span className="text-stone">— from the size grid</span>
              </p>
            </div>
          ) : (
            <Field label="Inventory">
              <input
                type="number"
                min="0"
                step="1"
                value={form.inventory}
                onChange={(e) =>
                  update(
                    "inventory",
                    e.target.value
                  )
                }
                className={inputClass}
              />
            </Field>
          )}
        </div>

        {Number(form.discountPercent) > 0 && Number(form.price) > 0 && (
          <div className="border border-mango/30 bg-mango/5 p-4">
            <p className="label-technical text-mango">SALE PRICE PREVIEW</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {previewWasPrice !== null && (
                <span className="font-mono text-sm text-stone-dark line-through">
                  {formatPrice(previewWasPrice)}
                </span>
              )}
              <span className="font-mono text-lg text-bone">
                {formatPrice(previewSalePrice)}
              </span>
              <span className="text-xs font-medium tracking-wider text-mango">
                {form.discountPercent}% OFF
              </span>
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-bone-dim">
          <input
            type="checkbox"
            checked={form.isNew}
            onChange={(e) =>
              update(
                "isNew",
                e.target.checked
              )
            }
            className="h-4 w-4 accent-[color:var(--color-mango)]"
          />

          Mark as &ldquo;NEW&rdquo; (featured in
          THE DROP on the homepage)
        </label>
      </fieldset>

      {/* =========================================================
          DESCRIPTION
          ========================================================= */}
      <fieldset className="flex flex-col gap-4">
        <legend className="label-technical mb-2">
          DESCRIPTION
        </legend>

        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) =>
              update(
                "description",
                e.target.value
              )
            }
            rows={3}
            className={inputClass}
          />
        </Field>

        <Field label="Details (one per line)">
          <textarea
            value={form.details}
            onChange={(e) =>
              update(
                "details",
                e.target.value
              )
            }
            rows={4}
            className={inputClass}
            placeholder={
              "240gsm heavyweight combed cotton\nGarment-dyed, enzyme-washed"
            }
          />
        </Field>
      </fieldset>

      {/* =========================================================
          VARIANTS
          ========================================================= */}
      <fieldset className="flex flex-col gap-4">
        <legend className="label-technical mb-2">
          VARIANTS
        </legend>

        <Field label="Sizes (comma-separated)">
          <input
            value={form.sizes}
            onChange={(e) =>
              update(
                "sizes",
                e.target.value
              )
            }
            className={inputClass}
            placeholder="XS, S, M, L, XL, XXL"
          />
        </Field>

        {/* =======================================================
            COLORS
            ======================================================= */}
        <div>
          <p className="label-technical mb-2">
            Colors
          </p>

          <div className="flex flex-col gap-2">
            {form.colors.map((color, index) => (
              <div
                key={index}
                className="flex flex-wrap items-center gap-2"
              >
                {/* Color preview / picker */}
                <input
                  type="color"
                  value={
                    /^#[0-9a-f]{6}$/i.test(
                      color.hex
                    )
                      ? color.hex
                      : "#8c8880"
                  }
                  onChange={(e) =>
                    updateColor(
                      index,
                      "hex",
                      e.target.value
                    )
                  }
                  className="h-10 w-10 shrink-0 cursor-pointer border border-line-strong bg-transparent"
                  aria-label={`Color swatch ${
                    index + 1
                  }`}
                />

                {/* Color name */}
                <input
                  value={color.name}
                  onChange={(e) =>
                    updateColorName(
                      index,
                      e.target.value
                    )
                  }
                  className={`${inputClass} min-w-[8rem] flex-1`}
                  placeholder="Void Black"
                />

                {/* HEX */}
                <input
                  value={color.hex}
                  onChange={(e) =>
                    updateColor(
                      index,
                      "hex",
                      e.target.value
                    )
                  }
                  className={`${inputClass} w-28 font-mono`}
                  placeholder="#0a0a0a"
                />

                {/* Remove color */}
                <button
                  type="button"
                  onClick={() =>
                    removeColor(index)
                  }
                  disabled={
                    form.colors.length <= 1
                  }
                  className="shrink-0 px-2 text-xs text-stone transition-colors hover:text-mango disabled:opacity-30"
                  aria-label="Remove color"
                >
                  ✕
                </button>

                {/* Photos for this colour */}
                <ColorPhotos
                  colorName={color.name}
                  images={form.colorImages[colorKey(color.name)] ?? []}
                  uploading={colorUploading === colorKey(color.name)}
                  onUpload={(files) => void handleColorImageUpload(colorKey(color.name), files)}
                  onChange={(images) => setColorImages(colorKey(color.name), images)}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addColor}
            className="mt-2 text-xs text-stone underline underline-offset-4 transition-colors hover:text-bone"
          >
            + Add color
          </button>

          <p className="mt-2 text-xs text-stone">
            Enter a standard color name such as
            Green, Red, Blue, Black or White to
            automatically update the HEX value and
            preview.
          </p>
          <p className="mt-1 text-xs text-stone">
            Colour photos (optional): the product page switches to these
            when a customer picks the colour. 1st photo = front, 2nd = back.
            No photos = the main product images are used.
          </p>
        </div>
      </fieldset>

      {/* =========================================================
          STOCK PER SIZE & COLOUR
          ========================================================= */}
      <fieldset className="flex flex-col gap-4">
        <legend className="label-technical mb-2">
          STOCK BY SIZE &amp; COLOUR
        </legend>

        <label className="flex items-start gap-2 text-sm text-bone-dim">
          <input
            type="checkbox"
            checked={form.trackVariants}
            onChange={(e) => update("trackVariants", e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--color-mango)]"
          />
          <span>
            Track stock for each size &amp; colour
            <span className="mt-0.5 block text-xs text-stone">
              Sold-out sizes are crossed out for customers and can&apos;t be
              ordered; they can ask to be emailed when it&apos;s back. Turn
              off to keep one stock number for the whole product.
            </span>
          </span>
        </label>

        {form.trackVariants && (
          <div className="overflow-x-auto border border-line-strong">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line-strong">
                  <th className="px-3 py-2 text-left text-xs font-normal text-stone">Colour \ Size</th>
                  {gridSizes.map((size) => (
                    <th key={size} className="px-2 py-2 text-center font-mono text-xs font-normal text-stone">
                      {size}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right text-xs font-normal text-stone">Total</th>
                </tr>
              </thead>
              <tbody>
                {gridColors.map((color, rowIndex) => {
                  const rowTotal = gridSizes.reduce(
                    (sum, size) => sum + (parseInt(form.variantStock[variantKey(color.name, size)] ?? "0", 10) || 0),
                    0
                  );
                  return (
                    <tr key={`${color.name}-${rowIndex}`} className="border-b border-line last:border-b-0">
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2 text-xs text-bone">
                          <span className="h-3 w-3 shrink-0 rounded-full border border-line-strong" style={{ backgroundColor: color.hex }} />
                          {color.name || "—"}
                        </span>
                      </td>
                      {gridSizes.map((size) => {
                        const key = variantKey(color.name, size);
                        const value = form.variantStock[key] ?? "";
                        return (
                          <td key={size} className="px-1.5 py-1.5 text-center">
                            <input
                              inputMode="numeric"
                              value={value}
                              placeholder="0"
                              onChange={(e) => setVariantStock(key, e.target.value)}
                              aria-label={`Stock for ${color.name || "product"} size ${size}`}
                              className={`w-14 border bg-transparent px-2 py-1.5 text-center font-mono text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none ${
                                (parseInt(value || "0", 10) || 0) === 0 ? "border-mango/40" : "border-line-strong"
                              }`}
                            />
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right font-mono text-xs text-bone-dim">{rowTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="border-t border-line px-3 py-2 text-xs text-stone">
              Total stock: <span className="font-mono text-bone">{gridTotal}</span> · cells outlined
              in green are sold out
            </p>
          </div>
        )}
      </fieldset>

      {/* =========================================================
          COMPLETE THE LOOK
          ========================================================= */}
      <fieldset className="flex flex-col gap-4">
        <legend className="label-technical mb-2">
          COMPLETE THE LOOK
        </legend>
        <p className="text-xs text-stone">
          Pick up to 4 products shown under &ldquo;Complete the look&rdquo; on this
          product&apos;s page. Leave empty to suggest matching pieces automatically.
        </p>

        {form.completeTheLook.length > 0 && (
          <ul className="flex flex-col gap-2">
            {form.completeTheLook.map((id, index) => {
              const picked = allProducts.find((candidate) => candidate.id === id);
              return (
                <li key={id} className="flex items-center gap-3 border border-line-strong p-2">
                  {picked?.images?.[0] ? (
                    <span
                      aria-hidden="true"
                      className="h-12 w-10 shrink-0 bg-void bg-contain bg-center bg-no-repeat"
                      style={{ backgroundImage: `url("${picked.images[0]}")` }}
                    />
                  ) : (
                    <span className="h-12 w-10 shrink-0 bg-charcoal" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs text-bone">
                    {index + 1}. {picked?.name ?? id}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        "completeTheLook",
                        form.completeTheLook.filter((item) => item !== id)
                      )
                    }
                    className="shrink-0 px-2 text-xs text-stone hover:text-mango"
                    aria-label={`Remove ${picked?.name ?? id}`}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {form.completeTheLook.length < 4 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                update("completeTheLook", [...form.completeTheLook, e.target.value]);
              }
            }}
            className={`${inputClass} bg-void`}
            aria-label="Add a product to Complete the look"
          >
            <option value="">+ Add a product…</option>
            {lookOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} ({option.category})
              </option>
            ))}
          </select>
        )}
      </fieldset>

      {/* =========================================================
          ERROR
          ========================================================= */}
      {error && (
        <p
          role="alert"
          className="text-sm text-mango"
        >
          {error}
        </p>
      )}

      {/* =========================================================
          ACTIONS
          ========================================================= */}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSaving || isUploading}
          className="bg-bone px-6 py-3 text-xs font-medium tracking-[0.2em] text-void transition-colors hover:bg-mango disabled:opacity-50"
        >
          {isSaving
            ? "SAVING…"
            : isEditing
              ? "SAVE CHANGES"
              : "CREATE PRODUCT"}
        </button>

        <button
          type="button"
          onClick={() =>
            router.push("/admin/products")
          }
          className="border border-line-strong px-6 py-3 text-xs tracking-[0.2em] text-bone-dim transition-colors hover:border-bone hover:text-bone"
        >
          CANCEL
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full border border-line-strong bg-transparent px-3.5 py-2.5 text-sm text-bone placeholder:text-stone-dark focus:outline-none focus:border-bone";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-stone">
        {label}
      </span>

      {children}
    </label>
  );
}
function ColorPhotos({
  colorName,
  images,
  uploading,
  onUpload,
  onChange,
}: {
  colorName: string;
  images: string[];
  uploading: boolean;
  onUpload: (files: FileList | null) => void;
  onChange: (images: string[]) => void;
}) {
  return (
    <div className="flex w-full basis-full flex-wrap items-center gap-2 pb-2 pl-12">
      {images.map((url, index) => (
        <div key={`${url}-${index}`} className="relative h-16 w-12 border border-line-strong">
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-void bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url("${url}")` }}
          />
          <span className="absolute bottom-0 left-0 bg-void/80 px-1 font-mono text-[8px] text-bone">
            {index === 0 ? "FRONT" : index === 1 ? "BACK" : index + 1}
          </span>
          <button
            type="button"
            onClick={() => onChange(images.filter((_, i) => i !== index))}
            className="absolute right-0 top-0 bg-void/80 px-1 text-[10px] text-bone hover:text-mango"
            aria-label={`Remove ${colorName} photo ${index + 1}`}
          >
            ✕
          </button>
          {index > 0 && (
            <button
              type="button"
              onClick={() => {
                const next = [...images];
                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                onChange(next);
              }}
              className="absolute left-0 top-0 bg-void/80 px-1 text-[10px] text-bone hover:text-mango"
              aria-label={`Move ${colorName} photo ${index + 1} earlier`}
            >
              ←
            </button>
          )}
        </div>
      ))}
      <label
        className={`flex h-16 w-24 cursor-pointer items-center justify-center border border-dashed border-line-strong px-1 text-center text-[10px] leading-tight text-stone transition-colors hover:border-bone hover:text-bone ${
          uploading ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => {
            onUpload(e.target.files);
            e.target.value = "";
          }}
        />
        {uploading ? "UPLOADING…" : `+ ${colorName || "colour"} photos`}
      </label>
    </div>
  );
}
