/** Read-only 0–5 star display (supports halves, e.g. 4.5). */
export default function StarRating({
  value,
  className = "h-3.5 w-3.5",
  label,
}: {
  value: number;
  className?: string;
  label?: string;
}) {
  const rounded = Math.round(value * 2) / 2;

  return (
    <span
      className="inline-flex items-center gap-0.5 text-mango"
      role="img"
      aria-label={label ?? `${value.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = rounded >= star ? 1 : rounded >= star - 0.5 ? 0.5 : 0;
        return (
          <svg key={star} viewBox="0 0 24 24" className={className} aria-hidden="true">
            <defs>
              <linearGradient id={`star-${star}-${fill}`}>
                <stop offset={`${fill * 100}%`} stopColor="currentColor" />
                <stop offset={`${fill * 100}%`} stopColor="transparent" />
              </linearGradient>
            </defs>
            <path
              d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8L12 2.8Z"
              fill={`url(#star-${star}-${fill})`}
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
        );
      })}
    </span>
  );
}
