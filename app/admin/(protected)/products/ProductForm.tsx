"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Product,
  ProductCategory,
  ProductColor,
} from "@/app/data/productTypes";

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
  description: string;
  details: string;
  colors: ProductColor[];
  sizes: string;
  images: string;
  dropLabel: string;
  isNew: boolean;
  inventory: string;
};

function productToForm(product?: Product): FormState {
  if (!product) {
    return {
      name: "",
      slug: "",
      category: "t-shirts",
      price: "",
      compareAtPrice: "",
      description: "",
      details: "",
      colors: [],
      sizes: "XS, S, M, L, XL, XXL",
      images: "",
      dropLabel: "",
      isNew: false,
      inventory: "0",
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
    setForm((current) => ({
      ...current,
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
    }));
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

    setIsSaving(true);

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      category: form.category,
      price: parseFloat(form.price) || 0,

      compareAtPrice: form.compareAtPrice
        ? parseFloat(form.compareAtPrice)
        : undefined,

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

      inventory:
        parseInt(form.inventory, 10) || 0,
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

        <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-3 gap-4">
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
        </div>

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
                className="flex items-center gap-2"
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
                  className={inputClass}
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
        </div>
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
      <div className="flex gap-3">
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