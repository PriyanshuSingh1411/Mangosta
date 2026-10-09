"use client";

import { useEffect, useState } from "react";
import type { ProductCategory } from "@/app/data/productTypes";
import {
  CATEGORY_LABELS,
  chartHasRows,
  convertMeasurement,
} from "@/app/data/storeTypes";
import type { MeasureUnit, SizeGuideConfig } from "@/app/data/storeTypes";

// Loaded once per page visit and shared by every size-guide link.
let guidePromise: Promise<SizeGuideConfig | null> | null = null;

function loadSizeGuide(): Promise<SizeGuideConfig | null> {
  if (!guidePromise) {
    guidePromise = fetch("/api/size-guide")
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
  }
  return guidePromise;
}

function useSizeGuide() {
  const [guide, setGuide] = useState<SizeGuideConfig | null>(null);

  useEffect(() => {
    let active = true;
    void loadSizeGuide().then((value) => {
      if (active) setGuide(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return guide;
}

/**
 * "SIZE GUIDE" link that opens the chart for the product's category.
 * Renders nothing until the admin has filled a chart for that category.
 */
export default function SizeGuideLink({
  category,
  className = "",
}: {
  category: ProductCategory;
  className?: string;
}) {
  const guide = useSizeGuide();
  const [open, setOpen] = useState(false);
  const chart = guide?.charts[category];

  if (!guide || !chartHasRows(chart)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-[10px] font-medium uppercase tracking-[0.18em] text-stone underline underline-offset-4 transition-colors hover:text-bone ${className}`}
      >
        Size guide
      </button>

      {open && (
        <SizeGuideModal guide={guide} category={category} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function SizeGuideModal({
  guide,
  category,
  onClose,
}: {
  guide: SizeGuideConfig;
  category: ProductCategory;
  onClose: () => void;
}) {
  const [unit, setUnit] = useState<MeasureUnit>(guide.unit);
  const chart = guide.charts[category]!;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[10030] flex items-end justify-center bg-void/75 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${CATEGORY_LABELS[category]} size guide`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        data-lenis-prevent
        className="max-h-[88svh] w-full max-w-2xl overflow-y-auto border border-line-strong bg-charcoal p-5 sm:p-7"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="label-technical mb-2">SIZE GUIDE</p>
            <h2 className="type-heading uppercase text-bone">
              {CATEGORY_LABELS[category]}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close size guide"
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-line-strong text-xl text-stone transition-colors hover:border-bone hover:text-bone"
          >
            ×
          </button>
        </div>

        <div className="mb-4 inline-flex border border-line-strong" role="group" aria-label="Units">
          {(["cm", "in"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setUnit(option)}
              aria-pressed={unit === option}
              className={`px-4 py-2 text-[10px] font-medium uppercase tracking-[0.18em] ${
                unit === option ? "bg-bone text-void" : "text-stone hover:text-bone"
              }`}
            >
              {option === "cm" ? "CM" : "INCHES"}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line-strong">
                <th className="py-3 pr-4 font-mono text-[10px] uppercase tracking-[0.16em] text-stone">Size</th>
                {chart.columns.map((column) => (
                  <th key={column} className="py-3 pr-4 font-mono text-[10px] uppercase tracking-[0.16em] text-stone">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.rows.map((row) => (
                <tr key={row.size} className="border-b border-line">
                  <td className="py-3 pr-4 font-medium text-bone">{row.size}</td>
                  {chart.columns.map((column, index) => (
                    <td key={column} className="py-3 pr-4 font-mono text-bone-dim">
                      {row.values[index] ? convertMeasurement(row.values[index], guide.unit, unit) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {chart.note && <p className="mt-4 text-xs leading-relaxed text-stone">{chart.note}</p>}

        {guide.howToMeasure && (
          <div className="mt-5 border-t border-line pt-4">
            <p className="label-technical mb-2">HOW TO MEASURE</p>
            <p className="whitespace-pre-line text-xs leading-relaxed text-stone">{guide.howToMeasure}</p>
          </div>
        )}
      </div>
    </div>
  );
}
