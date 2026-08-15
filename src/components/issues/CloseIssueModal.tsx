"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Issue } from "@/lib/types";
import { api } from "@/lib/clientApi";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { StarPicker, fmtRating } from "@/components/ui/StarPicker";
import { useActionError } from "@/components/ui/Toast";

interface Props {
  issue: Issue | null;
  onClose: () => void;
  onClosed: () => void;
}

export function CloseIssueModal({ issue, onClose, onClosed }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const { showError, errorEl } = useActionError();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(dialogRef, issue !== null);

  const close = useCallback(() => {
    if (busy) return;
    setRating(0);
    setComment("");
    onClose();
  }, [busy, onClose]);

  useEffect(() => {
    if (!issue) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [issue, close]);

  const submit = useCallback(async () => {
    if (!issue) return;
    setBusy(true);
    try {
      await api(`/api/issues/${issue.id}/feedback`, {
        method: "POST",
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      onClosed();
      setRating(0);
      setComment("");
      onClose();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }, [issue, rating, comment, onClosed, onClose, showError]);

  if (!issue) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Close issue" ref={dialogRef}>
      <div
        className="animate-overlay-in absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={() => close()}
        aria-hidden
      />
      <div className="animate-panel-in card relative w-full max-w-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Close issue</h2>
            <p className="mt-1 text-sm text-slate">
              {issue.issueNo} — rate the resolution to close this issue. Unrated issues auto-close after the
              feedback grace period.
            </p>
          </div>
          <button type="button" onClick={() => close()} disabled={busy} className="btn btn-ghost btn-sm" aria-label="Close">
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="label">Your rating</p>
            {rating > 0 && (
              <span className="rounded-full bg-accent-soft px-3 py-1 font-display text-sm font-semibold text-accent">
                {fmtRating(rating)}/5
              </span>
            )}
          </div>
          <div className="mt-2 flex justify-center rounded-2xl bg-paper py-4">
            <StarPicker value={rating} onChange={setRating} disabled={busy} />
          </div>
          <p className="mt-2 text-center text-xs text-slate">
            {rating === 0
              ? "Tap a star to rate — tap the same star again for a half step."
              : rating < 3
                ? "We'll look into this."
                : rating < 4
                  ? "Thanks for the feedback."
                  : "Glad we could help."}
          </p>
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="close-comment">
            Comment <span className="font-normal text-stone">(optional)</span>
          </label>
          <textarea
            id="close-comment"
            className="input resize-none"
            rows={3}
            maxLength={500}
            placeholder="Anything else we should know?"
            value={comment}
            disabled={busy}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        {errorEl}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => close()} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={busy || rating < 0.5}>
            {busy ? "Closing…" : "Close issue"}
          </button>
        </div>
      </div>
    </div>
  );
}
