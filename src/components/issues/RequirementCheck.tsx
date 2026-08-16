"use client";

import { useId } from "react";

interface RequirementCheckProps {
  checked: boolean;
  disabled?: boolean;
  onToggle?: () => void;
  title?: string;
  className?: string;
}

/** Animated SVG stroke-dash requirement checkbox (checked state draws the check mark). */
export function RequirementCheck({ checked, disabled, onToggle, title, className }: RequirementCheckProps) {
  const id = useId();
  const interactive = !disabled && !!onToggle;

  if (!interactive) {
    return (
      <span
        className={`req-check req-check--static ${className ?? ""}`}
        title={title}
        aria-label={title ?? (checked ? "Resolved" : "Unresolved")}
        role="img"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" className={checked ? "checked" : undefined}>
          <path d="M 1 9 L 1 9 c 0 -5 3 -8 8 -8 L 9 1 C 14 1 17 5 17 9 L 17 9 c 0 4 -4 8 -8 8 L 9 17 C 5 17 1 14 1 9 L 1 9 Z" />
          <polyline points="1 9 7 14 15 4" />
        </svg>
      </span>
    );
  }

  return (
    <label htmlFor={id} className={`req-check ${className ?? ""}`} title={title}>
      <input id={id} type="checkbox" className="req-check-input" checked={checked} onChange={() => onToggle()} />
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path d="M 1 9 L 1 9 c 0 -5 3 -8 8 -8 L 9 1 C 14 1 17 5 17 9 L 17 9 c 0 4 -4 8 -8 8 L 9 17 C 5 17 1 14 1 9 L 1 9 Z" />
        <polyline points="1 9 7 14 15 4" />
      </svg>
    </label>
  );
}
