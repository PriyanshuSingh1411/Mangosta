"use client";

import { useMemo } from "react";

/**
 * Deterministic placeholder art for products without photography yet.
 * Intentionally reads as a design-system placeholder (garment silhouette +
 * technical grid + seed-based accent) rather than attempting to fake real
 * product photography, per the brief's explicit instruction. Swap for real
 * imagery by replacing this component's usage in ProductCard / ProductGallery.
 */
export default function ProductPlaceholderArt({
  seed,
  className = "",
}: {
  seed: string;
  className?: string;
}) {
  const hash = useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = (h << 5) - h + seed.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }, [seed]);

  // SVG id/url(#...) references break on whitespace and other special
  // characters, and seeds here are often composed (e.g. product id + color
  // name), so build a safe id from the hash rather than the raw seed.
  const gradId = `grad-${hash}`;

  const rotation = (hash % 7) - 3;
  const useAccent = hash % 3 === 0;
  const silhouette = hash % 3;

  return (
    <div
      className={`relative flex items-center justify-center bg-charcoal ${className}`}
      aria-hidden="true"
    >
      {/* technical grid backdrop */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.07]"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 12.5} y1={0} x2={i * 12.5} y2={100} stroke="#f5f2ec" strokeWidth="0.15" />
        ))}
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 12.5} x2={100} y2={i * 12.5} stroke="#f5f2ec" strokeWidth="0.15" />
        ))}
      </svg>

      <svg
        viewBox="0 0 200 260"
        className="h-[62%] w-auto"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={useAccent ? "#c4ff61" : "#e8e3d8"} stopOpacity="0.95" />
            <stop offset="55%" stopColor={useAccent ? "#8fbf47" : "#8c8880"} stopOpacity="0.6" />
            <stop offset="100%" stopColor="#2a2822" stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id={`glow-${gradId}`} cx="35%" cy="25%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {silhouette === 0 && (
          // tee silhouette
          <path
            d="M60 20 L80 8 L100 20 L120 8 L140 20 L155 45 L135 58 L128 48 L128 240 L72 240 L72 48 L65 58 L45 45 Z"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        )}
        {silhouette === 1 && (
          // hoodie silhouette
          <path
            d="M100 12 C70 12 55 30 55 46 L30 62 L45 88 L60 78 L60 240 L140 240 L140 78 L155 88 L170 62 L145 46 C145 30 130 12 100 12 Z M100 30 C112 30 120 40 120 50 L80 50 C80 40 88 30 100 30 Z"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        )}
        {silhouette === 2 && (
          // jacket/pants technical silhouette
          <g fill="none" stroke={`url(#${gradId})`} strokeWidth="2.5" strokeLinejoin="round">
            <path d="M65 20 L100 8 L135 20 L150 42 L132 54 L126 44 L126 235 L100 235 L100 130 L74 235 L48 235 L48 44 L42 54 L24 42 Z" />
          </g>
        )}

        {/* technical annotation marks */}
        <circle cx="100" cy="130" r="1.6" fill="#c4ff61" opacity="0.8" />
        <line x1="100" y1="130" x2="170" y2="130" stroke="#c4ff61" strokeWidth="0.5" opacity="0.5" />
      </svg>

      <span className="absolute bottom-3 right-3 font-mono text-[9px] tracking-[0.15em] text-stone-dark">
        MG—{String(hash % 1000).padStart(3, "0")}
      </span>
    </div>
  );
}
