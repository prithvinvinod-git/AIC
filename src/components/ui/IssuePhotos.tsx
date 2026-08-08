"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";
import type { ImageRef } from "@/lib/types";

/**
 * Clickable issue photo thumbnails. Clicking any thumbnail (or the "+N" tile)
 * opens a fullscreen lightbox with the large image and prev/next navigation.
 * When `placeholder` is set and no photos exist, an empty tile the same size
 * as a thumbnail is rendered so surrounding layout (e.g. card footers) stays
 * aligned whether or not photos were submitted.
 */
export function IssuePhotos({
  images,
  size = 72,
  limit = 4,
  placeholder = false,
}: {
  images: ImageRef[];
  size?: number;
  limit?: number;
  placeholder?: boolean;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const visible = images.slice(0, limit);
  const extra = images.length - visible.length;

  useEffect(() => {
    if (openIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenIdx(null);
        return;
      }
      if (e.key === "ArrowRight") setOpenIdx((i) => (i === null ? i : (i + 1) % images.length));
      if (e.key === "ArrowLeft") setOpenIdx((i) => (i === null ? i : (i - 1 + images.length) % images.length));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [openIdx, images.length]);

  if (images.length === 0 && !placeholder) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {images.length === 0 ? (
          <div
            className="flex items-center justify-center rounded-xl border border-dashed border-silver bg-paper text-slate"
            style={{ width: size, height: size }}
            role="img"
            aria-label="No image"
            title="No image"
          >
            <ImageOff className="h-10 w-10" aria-hidden />
          </div>
        ) : (
          visible.map((im, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setOpenIdx(i)}
              className="overflow-hidden rounded-xl border border-silver transition-opacity hover:opacity-80"
              style={{ width: size, height: size }}
              aria-label={`View photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ))
        )}
        {extra > 0 && (
          <button
            type="button"
            onClick={() => setOpenIdx(limit)}
            className="flex items-center justify-center rounded-xl border border-silver bg-paper text-sm font-medium text-slate transition-colors hover:bg-silver"
            style={{ width: size, height: size }}
          >
            +{extra}
          </button>
        )}
      </div>

      {openIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="animate-overlay-in absolute inset-0 bg-ink/70 backdrop-blur-sm"
            onClick={() => setOpenIdx(null)}
            aria-hidden
          />
          <div className="animate-panel-in relative flex max-h-[85vh] max-w-[92vw] flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[openIdx].url}
              alt={`Photo ${openIdx + 1}`}
              className="max-h-[80vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
            />
            <div className="mt-3 flex items-center gap-4">
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={() => setOpenIdx((openIdx - 1 + images.length) % images.length)}
                  className="btn btn-ghost btn-sm"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Prev
                </button>
              )}
              <span className="text-sm font-medium text-white">
                {openIdx + 1} / {images.length}
              </span>
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={() => setOpenIdx((openIdx + 1) % images.length)}
                  className="btn btn-ghost btn-sm"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpenIdx(null)}
            className="absolute right-5 top-5 flex h-[50px] w-[50px] items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Close viewer"
          >
            <X className="h-7 w-7" aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}
