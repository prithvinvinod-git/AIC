"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { EASTER_EGG_META, EASTER_EGG_SLUGS, type EasterEggEvent } from "@/lib/types";

interface EventPickerProps {
  value: EasterEggEvent | null;
  onChange: (event: EasterEggEvent | null) => void;
}

export default function EventPicker({ value, onChange }: EventPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, open);

  const filtered = EASTER_EGG_SLUGS.filter((slug) => {
    if (!query.trim()) return true;
    const meta = EASTER_EGG_META[slug];
    const q = query.toLowerCase();
    return meta.label.toLowerCase().includes(q) || meta.description.toLowerCase().includes(q);
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const selected = value ? EASTER_EGG_META[value] : null;

  return (
    <>
      {value && selected ? (
        <div className="flex items-center gap-2">
          <span className="tag bg-accent-soft text-accent flex items-center gap-1">
            <selected.Icon className="h-3.5 w-3.5" aria-hidden /> {selected.label}
          </span>
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center rounded-full bg-silver text-slate hover:bg-danger hover:text-white transition-colors"
            onClick={() => onChange(null)}
            aria-label="Remove easter egg"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setOpen(true)}
        >
          Pick an event
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" ref={dialogRef}>
          <div className="animate-overlay-in absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/60" onClick={() => setOpen(false)} aria-hidden />
          <div className="animate-panel-in card relative flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 border-b border-silver px-5 py-4">
              <h2 className="font-display text-lg font-semibold text-ink">Choose an event</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>

            <div className="border-b border-silver px-5 py-3">
              <div className="flex items-center gap-2 rounded-xl border border-silver bg-paper px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-slate" aria-hidden />
                <input
                  type="text"
                  placeholder="Search events…"
                  className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-slate"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
                {query && (
                  <button type="button" onClick={() => setQuery("")} className="text-slate hover:text-ink">
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate">No events match your search.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {filtered.map((slug) => {
                    const meta = EASTER_EGG_META[slug];
                    const active = value === slug;
                    return (
                      <button
                        key={slug}
                        type="button"
                        className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all hover:scale-[1.03] ${
                          active
                            ? "border-accent bg-accent-soft shadow-sm"
                            : "border-silver bg-paper hover:border-graphite"
                        }`}
                        onClick={() => { onChange(slug); setOpen(false); }}
                      >
                        <meta.Icon className="h-8 w-8 text-accent" aria-hidden />
                        <span className="text-sm font-medium text-graphite">{meta.label}</span>
                        <span className="text-xs text-slate leading-tight">{meta.description}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
