"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import type { Issue } from "@/lib/types";
import { api, ApiError } from "@/lib/clientApi";

interface Props {
  issue: Issue | null;
  onClose: () => void;
  onClosed: () => void;
}

export function CloseIssueModal({ issue, onClose, onClosed }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    if (busy) return;
    setError(null);
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
    setError(null);
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
      setError(e instanceof ApiError ? e.message : "Failed to close the issue.");
    } finally {
      setBusy(false);
    }
  }, [issue, rating, comment, onClosed, onClose]);

  if (!issue) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
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
              {issue.issueNo} — rate the resolution to close this issue.
            </p>
          </div>
          <button type="button" onClick={() => close()} disabled={busy} className="btn btn-ghost btn-sm" aria-label="Close">
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        <div className="mt-5">
          <p className="label">Your rating</p>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRating(r)}
                disabled={busy}
                aria-label={`${r} star${r === 1 ? "" : "s"}`}
                className="rounded-lg p-0.5 transition-transform hover:scale-110"
              >
                <Star
                  className={`h-9 w-9 ${
                    r <= rating ? "fill-[#f59e0b] text-[#f59e0b]" : "text-stone"
                  }`}
                  aria-hidden
                />
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate">
            {rating === 0
              ? "Tap at least one star to close."
              : rating <= 2
                ? "We'll look into this."
                : rating === 3
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

        {error && <p className="mt-3 text-sm text-[#c0392b]">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => close()} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={busy || rating < 1}>
            {busy ? "Closing…" : "Close issue"}
          </button>
        </div>
      </div>
    </div>
  );
}
