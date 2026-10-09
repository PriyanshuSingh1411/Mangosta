"use client";

import { useState } from "react";
import Link from "next/link";

type ImportResponse = {
  success?: boolean;
  imported?: number;
  error?: string;
  errors?: string[];
};

export default function ProductImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        "/api/admin/products/import",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setResult(data);
        return;
      }

      setResult(data);
      setFile(null);
    } catch {
      setResult({
        error: "Something went wrong while importing products.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-technical mb-2">
            CATALOG / BULK IMPORT
          </p>

          <h1 className="type-heading text-bone">
            Import Products
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone">
            Upload one Excel file to import multiple products,
            colours, sizes, inventory and product images.
          </p>
        </div>

        <Link
          href="/admin/products"
          className="border border-line-strong px-4 py-2 text-xs tracking-[0.12em] text-stone transition-colors hover:text-bone"
        >
          BACK TO PRODUCTS
        </Link>
      </div>

      <div className="border border-line p-6 sm:p-8">
        <label
          htmlFor="product-file"
          className="flex min-h-52 cursor-pointer flex-col items-center justify-center border border-dashed border-line-strong px-6 text-center transition-colors hover:border-mango"
        >
          <span className="label-technical mb-3">
            XLSX FILE
          </span>

          <span className="text-sm text-bone">
            {file
              ? file.name
              : "Click to choose your product Excel file"}
          </span>

          <span className="mt-2 text-xs text-stone">
            Products + Variants sheets required
          </span>

          <input
            id="product-file"
            type="file"
            accept=".xlsx"
            className="sr-only"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setResult(null);
            }}
          />
        </label>

        <button
          type="button"
          disabled={!file || isImporting}
          onClick={handleImport}
          className="mt-6 w-full bg-bone px-5 py-3 text-xs font-medium tracking-[0.15em] text-void transition-colors hover:bg-mango disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isImporting
            ? "IMPORTING..."
            : "IMPORT PRODUCTS"}
        </button>
      </div>

      {result?.success && (
        <div className="mt-6 border border-line p-6">
          <p className="label-technical mb-2 text-mango">
            IMPORT COMPLETE
          </p>

          <p className="text-sm text-bone">
            Successfully imported {result.imported}{" "}
            {result.imported === 1 ? "product" : "products"}.
          </p>

          <Link
            href="/admin/products"
            className="mt-4 inline-block text-xs text-stone underline underline-offset-4 hover:text-bone"
          >
            View products
          </Link>
        </div>
      )}

      {result?.errors && result.errors.length > 0 && (
        <div className="mt-6 border border-mango p-6">
          <p className="label-technical mb-3 text-mango">
            IMPORT FAILED
          </p>

          <ul className="space-y-2 text-xs leading-5 text-stone">
            {result.errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {result?.error && !result.errors && (
        <div className="mt-6 border border-mango p-6">
          <p className="text-sm text-mango">
            {result.error}
          </p>
        </div>
      )}

      <div className="mt-8 border border-line p-6">
        <p className="label-technical mb-4">
          EXCEL FORMAT
        </p>

        <div className="space-y-4 text-xs leading-6 text-stone">
          <div>
            <p className="mb-1 text-bone">Products sheet</p>
            <p>
              productId, name, slug, price, discount,
              category, description, details, compareAtPrice,
              dropLabel, isNew
            </p>
          </div>

          <div>
            <p className="mb-1 text-bone">Variants sheet</p>
            <p>
              productId, color, size, inventory, images
            </p>
          </div>

          <div>
            <p className="mb-1 text-bone">Multiple values</p>
            <p>
              Separate multiple values with{" "}
              <span className="font-mono text-bone">|</span>
            </p>
          </div>

          <div>
            <p className="mb-1 text-bone">Images</p>
            <p>
              Use complete public HTTPS image URLs and
              separate multiple images with{" "}
              <span className="font-mono text-bone">|</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}