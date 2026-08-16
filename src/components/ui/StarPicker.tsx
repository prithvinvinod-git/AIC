"use client";

import { useState } from "react";
import { Star } from "lucide-react";

function StarGlyph({ filled, half, size }: { filled: boolean; half: boolean; size: number }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }} aria-hidden>
      <Star className="absolute inset-0 text-silver" size={size} fill="currentColor" strokeWidth={1.5} />
      {half && (
        <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: size / 2 }}>
          <Star className="text-accent" size={size} fill="currentColor" strokeWidth={1.5} />
        </span>
      )}
      {filled && (
        <Star className="absolute inset-0 text-accent" size={size} fill="currentColor" strokeWidth={1.5} />
      )}
    </span>
  );
}

export function fmtRating(r: number): string {
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/**
 * Interactive 5-star picker with half-star support.
 *
 * Clicking star N sets N/5 (full). Clicking the same star again toggles it to
 * N−0.5 (half); a third click returns to N/5. Hovering previews the value the
 * next click will set.
 */
export function StarPicker({
  value,
  onChange,
  disabled = false,
  size = 44,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const preview = hover === null ? value : hover === value ? value - 0.5 : hover;

  return (
    <div className="inline-flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={disabled}
          aria-label={`${i} star${i === 1 ? "" : "s"}`}
          title={hover === null ? undefined : preview >= i - 0.5 ? `${fmtRating(hover === value ? value - 0.5 : hover)}/5` : undefined}
          onClick={() => { onChange(value === i ? i - 0.5 : i); setHover(null); }}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(i)}
          onBlur={() => setHover(null)}
          className="rounded-lg p-0.5 transition-transform duration-150 hover:scale-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <StarGlyph filled={preview >= i} half={preview >= i - 0.5 && preview < i} size={size} />
        </button>
      ))}
    </div>
  );
}
