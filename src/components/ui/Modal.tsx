"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Centered dialog with overlay, Escape-to-close and focus trapping. */
export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 max-md:p-3"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      ref={dialogRef}
    >
      <div
        className="animate-overlay-in absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      <div className="animate-panel-in card relative w-full max-w-md">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Close">
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
