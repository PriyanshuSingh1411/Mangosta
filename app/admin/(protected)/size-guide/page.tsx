"use client";

import { useEffect, useState } from "react";
import type { Product, ProductCategory } from "@/app/data/productTypes";
import { CATEGORY_LABELS, PRODUCT_CATEGORIES } from "@/app/data/storeTypes";
import type { SizeChart, SizeGuideConfig } from "@/app/data/storeTypes";
import { adminButtonClass, adminInputClass, useStoreConfig } from "../useStoreConfig";

const SUGGESTED_COLUMNS: Record<ProductCategory, string[]> = {
  "t-shirts": ["Chest", "Length", "Shoulder", "Sleeve"],
  hoodies: ["Chest", "Length", "Shoulder", "Sleeve"],
  jackets: ["Chest", "Length", "Shoulder", "Sleeve"],
  pants: ["Waist", "Hip", "Inseam", "Length"],
  accessories: ["Head circumference"],
};

const EMPTY_CHART: SizeChart = { columns: [], rows: [], note: "" };

export default function AdminSizeGuidePage() {
  const { value, update, save, loading, saving, error, saved } =
    useStoreConfig<SizeGuideConfig>("sizeGuide");
  const [category, setCategory] = useState<ProductCategory>("t-shirts");
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch("/api/admin/products", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => undefined);
  }, []);

  if (loading || !value) {
    return (
      <div>
        <p className="label-technical mb-2">STOREFRONT</p>
        <h1 className="type-heading text-bone">Size Guide</h1>
        <p className="mt-8 text-sm text-stone">{error ?? "Loading…"}</p>
      </div>
    );
  }

  const chart = value.charts[category] ?? EMPTY_CHART;

  const setChart = (next: SizeChart) =>
    update({ charts: { ...value.charts, [category]: next } });

  const sizesInUse = [
    ...new Set(products.filter((p) => p.category === category).flatMap((p) => p.sizes)),
  ];

  const setColumns = (columns: string[]) =>
    setChart({
      ...chart,
      columns,
      rows: chart.rows.map((row) => ({
        ...row,
        values: columns.map((_, index) => row.values[index] ?? ""),
      })),
    });

  return (
    <div className="max-w-4xl">
      <p className="label-technical mb-2">STOREFRONT</p>
      <h1 className="mb-3 type-heading text-bone">Size Guide</h1>
      <p className="mb-8 max-w-2xl text-sm leading-relaxed text-stone">
        One chart per category. A &ldquo;Size guide&rdquo; link appears next to the size
        buttons on product pages once a category&apos;s chart has at least one row.
        Customers can switch between cm and inches.
      </p>

      <div className="mb-8 grid gap-5 border border-line-strong bg-charcoal/30 p-5 sm:grid-cols-[200px_1fr]">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-stone">I&apos;m entering measurements in</span>
          <select
            value={value.unit}
            onChange={(e) => update({ unit: e.target.value === "in" ? "in" : "cm" })}
            className={`${adminInputClass} bg-void`}
          >
            <option value="cm">Centimetres (cm)</option>
            <option value="in">Inches (in)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-stone">How to measure (shown under every chart)</span>
          <textarea
            value={value.howToMeasure}
            onChange={(e) => update({ howToMeasure: e.target.value })}
            rows={3}
            className={adminInputClass}
          />
        </label>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5" role="tablist" aria-label="Category">
        {PRODUCT_CATEGORIES.map((option) => {
          const filled = (value.charts[option]?.rows.length ?? 0) > 0;
          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={category === option}
              onClick={() => setCategory(option)}
              className={`px-3 py-2 text-xs uppercase tracking-wide transition-colors ${
                category === option
                  ? "bg-bone text-void"
                  : "border border-line-strong text-stone hover:border-bone hover:text-bone"
              }`}
            >
              {CATEGORY_LABELS[option]}
              {filled ? " ✓" : ""}
            </button>
          );
        })}
      </div>

      <section className="flex flex-col gap-5 border border-line-strong p-5">
        <div>
          <p className="mb-2 text-xs text-stone">Measurements (columns)</p>
          <div className="flex flex-wrap items-center gap-2">
            {chart.columns.map((column, index) => (
              <span key={index} className="flex items-center border border-line-strong">
                <input
                  value={column}
                  onChange={(e) =>
                    setColumns(chart.columns.map((item, i) => (i === index ? e.target.value : item)))
                  }
                  aria-label={`Column ${index + 1} name`}
                  className="w-32 bg-transparent px-2.5 py-2 text-sm text-bone focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setColumns(chart.columns.filter((_, i) => i !== index))}
                  className="px-2 text-xs text-stone hover:text-mango"
                  aria-label={`Remove column ${column}`}
                >
                  ✕
                </button>
              </span>
            ))}
            {chart.columns.length < 8 && (
              <button
                type="button"
                onClick={() => setColumns([...chart.columns, "New"])}
                className="border border-dashed border-line-strong px-3 py-2 text-xs text-stone hover:border-bone hover:text-bone"
              >
                + Column
              </button>
            )}
            {chart.columns.length === 0 && (
              <button
                type="button"
                onClick={() => setColumns(SUGGESTED_COLUMNS[category])}
                className="border border-line-strong px-3 py-2 text-xs text-bone hover:border-bone"
              >
                Use {SUGGESTED_COLUMNS[category].join(", ")}
              </button>
            )}
          </div>
        </div>

        {chart.columns.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line-strong">
                  <th className="px-2 py-2 text-left text-xs font-normal text-stone">Size</th>
                  {chart.columns.map((column, index) => (
                    <th key={index} className="px-2 py-2 text-left text-xs font-normal text-stone">
                      {column} ({value.unit})
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-line">
                    <td className="px-1 py-1.5">
                      <input
                        value={row.size}
                        onChange={(e) =>
                          setChart({
                            ...chart,
                            rows: chart.rows.map((item, i) => (i === rowIndex ? { ...item, size: e.target.value } : item)),
                          })
                        }
                        aria-label={`Row ${rowIndex + 1} size`}
                        className="w-20 border border-line-strong bg-transparent px-2 py-1.5 font-mono text-sm text-bone focus:border-bone focus:outline-none"
                      />
                    </td>
                    {chart.columns.map((column, colIndex) => (
                      <td key={colIndex} className="px-1 py-1.5">
                        <input
                          value={row.values[colIndex] ?? ""}
                          placeholder="e.g. 104"
                          onChange={(e) =>
                            setChart({
                              ...chart,
                              rows: chart.rows.map((item, i) =>
                                i === rowIndex
                                  ? {
                                      ...item,
                                      values: chart.columns.map((_, c) =>
                                        c === colIndex ? e.target.value : item.values[c] ?? ""
                                      ),
                                    }
                                  : item
                              ),
                            })
                          }
                          aria-label={`${row.size || "Row"} ${column}`}
                          className="w-24 border border-line-strong bg-transparent px-2 py-1.5 font-mono text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                        />
                      </td>
                    ))}
                    <td className="px-1 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => setChart({ ...chart, rows: chart.rows.filter((_, i) => i !== rowIndex) })}
                        className="px-2 text-xs text-stone hover:text-mango"
                        aria-label={`Remove row ${row.size}`}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setChart({
                    ...chart,
                    rows: [...chart.rows, { size: "", values: chart.columns.map(() => "") }],
                  })
                }
                className="border border-dashed border-line-strong px-3 py-2 text-xs text-stone hover:border-bone hover:text-bone"
              >
                + Size row
              </button>
              {sizesInUse.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const existing = new Set(chart.rows.map((row) => row.size));
                    setChart({
                      ...chart,
                      rows: [
                        ...chart.rows,
                        ...sizesInUse
                          .filter((size) => !existing.has(size))
                          .map((size) => ({ size, values: chart.columns.map(() => "") })),
                      ],
                    });
                  }}
                  className="border border-line-strong px-3 py-2 text-xs text-bone hover:border-bone"
                >
                  Add sizes used by {CATEGORY_LABELS[category]} ({sizesInUse.join(", ")})
                </button>
              )}
            </div>
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-stone">Note for this chart (optional)</span>
          <input
            value={chart.note}
            onChange={(e) => setChart({ ...chart, note: e.target.value })}
            placeholder="Oversized fit — size down for a regular fit."
            className={adminInputClass}
          />
        </label>
      </section>

      {error && <p role="alert" className="mt-6 text-sm text-mango">{error}</p>}

      <div className="mt-8 flex items-center gap-4">
        <button type="button" onClick={() => void save()} disabled={saving} className={adminButtonClass}>
          {saving ? "SAVING…" : "SAVE SIZE GUIDE"}
        </button>
        {saved && <span className="text-xs text-mango">Saved.</span>}
      </div>
    </div>
  );
}
