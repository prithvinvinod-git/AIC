"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ROLE_LABEL } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { Announcement, AnnouncementAudience, Role } from "@/lib/types";

function audienceLabel(a: AnnouncementAudience): string {
  if (a.kind === "all") return "All roles";
  return a.roles.map((r) => ROLE_LABEL[r as Role]).join(", ");
}

/** Full-detail popup for an announcement, including its images. */
export function AnnouncementModal({ announcement, onClose }: { announcement: Announcement; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const author = announcement.author;
  const authorRole = author.role ? (ROLE_LABEL[author.role] ?? author.role) : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={announcement.title}
      ref={dialogRef}
    >
      <div className="animate-overlay-in absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/60" onClick={onClose} aria-hidden />
      <div className="animate-panel-in card relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden p-0">
        <div className="flex items-start justify-between gap-3 border-b border-silver px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-ink">{announcement.title}</h2>
            <p className="mt-1 text-sm text-slate">
              {author.name}
              {authorRole ? ` · ${authorRole}` : ""} · {formatDateTime(announcement.createdAt)}
            </p>
            <span className="tag tag-outline mt-2">{audienceLabel(announcement.audience)}</span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-graphite">{announcement.body}</p>
          {announcement.images.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              {announcement.images.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt={`${announcement.title} — image ${i + 1}`}
                  className="w-full rounded-xl object-cover"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
