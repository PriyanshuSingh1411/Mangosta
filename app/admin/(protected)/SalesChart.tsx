"use client";

import { useState } from "react";
import { formatPrice } from "@/app/data/productTypes";

export type SalesDay = {
  /** YYYY-MM-DD (India time) */
  date: string;
  revenue: number;
  orders: number;
};

const HEIGHT = 200;
const PAD_LEFT = 56;
const PAD_BOTTOM = 26;
const PAD_TOP = 12;

function niceStep(max: number): number {
  if (max <= 0) return 1000;
  const raw = max / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return nice * power;
}

function shortDate(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${day} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1]}`;
}

function compactRupees(value: number): string {
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(value % 100_000 === 0 ? 0 : 1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `₹${value}`;
}

/** Daily revenue columns with a hover tooltip and a data-table view. */
export default function SalesChart({ days }: { days: SalesDay[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const width = 760;
  const plotWidth = width - PAD_LEFT - 8;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const max = Math.max(0, ...days.map((day) => day.revenue));
  const step = niceStep(max);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  const slot = plotWidth / Math.max(1, days.length);
  const barWidth = Math.max(2, Math.min(24, slot - 2));
  const labelEvery = Math.ceil(days.length / 8);

  const y = (value: number) => PAD_TOP + plotHeight - (value / top) * plotHeight;
  const hovered = hover !== null ? days[hover] : null;

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className="h-auto w-full"
          role="img"
          aria-label="Daily revenue"
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD_LEFT}
                x2={width - 8}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <text
                x={PAD_LEFT - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-stone font-mono text-[10px]"
              >
                {compactRupees(tick)}
              </text>
            </g>
          ))}

          {days.map((day, index) => {
            const x = PAD_LEFT + index * slot + (slot - barWidth) / 2;
            const barTop = y(day.revenue);
            const h = Math.max(0, PAD_TOP + plotHeight - barTop);
            const r = Math.min(4, h, barWidth / 2);
            const base = PAD_TOP + plotHeight;

            return (
              <g key={day.date}>
                {h > 0 && (
                  <path
                    d={`M${x},${base} V${barTop + r} Q${x},${barTop} ${x + r},${barTop} H${x + barWidth - r} Q${x + barWidth},${barTop} ${x + barWidth},${barTop + r} V${base} Z`}
                    className="fill-mango"
                    opacity={hover === null || hover === index ? 1 : 0.45}
                  />
                )}
                {/* hit target: the whole column slot */}
                <rect
                  x={PAD_LEFT + index * slot}
                  y={PAD_TOP}
                  width={slot}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setHover(index)}
                />
                {index % labelEvery === 0 && (
                  <text
                    x={PAD_LEFT + index * slot + slot / 2}
                    y={HEIGHT - 8}
                    textAnchor="middle"
                    className="fill-stone font-mono text-[10px]"
                  >
                    {shortDate(day.date)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {hovered && hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 border border-line-strong bg-void px-3 py-2 text-xs shadow-lg"
            style={{ left: `${((PAD_LEFT + hover * slot + slot / 2) / width) * 100}%` }}
          >
            <p className="font-mono text-stone">{shortDate(hovered.date)}</p>
            <p className="mt-0.5 text-bone">{formatPrice(hovered.revenue)}</p>
            <p className="text-stone">{hovered.orders} order{hovered.orders === 1 ? "" : "s"}</p>
          </div>
        )}
      </div>

      <details className="mt-3 text-xs text-stone">
        <summary className="cursor-pointer select-none hover:text-bone">View as table</summary>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="py-1.5 font-normal">Date</th>
                <th className="py-1.5 text-right font-normal">Orders</th>
                <th className="py-1.5 text-right font-normal">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.date} className="border-b border-line/60">
                  <td className="py-1.5 font-mono">{day.date}</td>
                  <td className="py-1.5 text-right font-mono">{day.orders}</td>
                  <td className="py-1.5 text-right type-price text-bone-dim">{formatPrice(day.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
