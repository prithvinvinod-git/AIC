import { Star } from "lucide-react";

function StarPart({ filled, half, size }: { filled: boolean; half: boolean; size: number }) {
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

/** Read-only 5-star display supporting full/half/empty steps (0.5 increments). */
export function FeedbackStars({
  rating,
  size = 14,
  className,
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className ?? ""}`}
      role="img"
      aria-label={`${Number.isInteger(rating) ? rating : rating.toFixed(1)} out of 5 stars`}
      title={`${Number.isInteger(rating) ? rating : rating.toFixed(1)}/5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <StarPart key={i} filled={rating >= i} half={rating >= i - 0.5 && rating < i} size={size} />
      ))}
    </span>
  );
}
