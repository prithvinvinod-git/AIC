"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, MessageSquareText, X } from "lucide-react";
import type { Comment } from "@/lib/types";
import { api } from "@/lib/clientApi";
import { useAuth } from "@/components/auth/AuthProvider";
import { formatDateTime } from "@/lib/format";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useActionError } from "@/components/ui/Toast";

interface Props {
  issueId: string;
  comments: Comment[];
  onReload: () => void;
}

function CommentItem({
  comment,
  liked,
  busy,
  onToggle,
}: {
  comment: Comment;
  liked: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="rounded-xl bg-paper p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-graphite">{comment.author.name}</p>
        <span className="text-xs text-slate">{formatDateTime(comment.at)}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate max-md:text-[13px]">{comment.body}</p>
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        aria-label={liked ? "Unlike comment" : "Like comment"}
        className={`mt-2 flex items-center gap-1 text-xs transition-colors disabled:opacity-50 ${
          liked ? "text-danger" : "text-slate hover:text-danger"
        }`}
      >
        <Heart
          className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`}
          aria-hidden
        />
        {comment.likes || 0}
      </button>
    </li>
  );
}

export function CommentsSection({ issueId, comments, onReload }: Props) {
  const { user } = useAuth();
  const userId = user?.uid;

  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<Comment[]>(comments);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [likeBusy, setLikeBusy] = useState<string | null>(null);
  const { showError, errorEl } = useActionError();

  useFocusTrap(dialogRef, open);

  const [prevComments, setPrevComments] = useState(comments);
  if (prevComments !== comments) {
    setPrevComments(comments);
    setItems(comments);
  }

  const close = useCallback(() => {
    if (busy) return;
    setOpen(false);
  }, [busy]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  const post = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setBusy(true);
      try {
        await api(`/api/issues/${issueId}/comments`, {
          method: "POST",
          body: JSON.stringify({ body: comment }),
        });
        setComment("");
        onReload();
      } catch (e2) {
        showError(e2);
      } finally {
        setBusy(false);
      }
    },
    [issueId, comment, onReload, showError]
  );

  const toggleLike = useCallback(
    async (c: Comment) => {
      if (!c.id || likeBusy) return;
      setLikeBusy(c.id);
      try {
        const res = await api<{ liked: boolean; likes: number }>(
          `/api/issues/${issueId}/comments/${c.id}/like`,
          { method: "POST" }
        );
        setItems((prev) =>
          prev.map((x) => {
            if (x.id !== c.id) return x;
            const uids = new Set(x.likedByUids ?? []);
            if (res.liked) uids.add(userId!);
            else uids.delete(userId!);
            return { ...x, likes: res.likes, likedByUids: [...uids] };
          })
        );
      } catch (e2) {
        showError(e2);
      } finally {
        setLikeBusy(null);
      }
    },
    [issueId, likeBusy, userId, showError]
  );

  const lastThree = items.slice(-3);

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg max-md:text-base font-semibold text-ink">Comments</h2>
        <span className="text-xs text-slate">{items.length}</span>
      </div>

      <button
        type="button"
        className="mt-3 w-full rounded-xl border border-dashed border-silver bg-paper px-3 py-2.5 text-left text-sm text-slate transition-colors hover:border-slate hover:text-graphite"
        onClick={() => setOpen(true)}
      >
        <MessageSquareText className="mr-1.5 inline h-4 w-4 align-[-3px]" aria-hidden />
        Add a comment…
      </button>
      {items.length > 0 && (
        <>
          <ul className="mt-4 flex flex-col gap-3">
            {lastThree.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                liked={!!(userId && (c.likedByUids ?? []).includes(userId))}
                busy={likeBusy === c.id}
                onToggle={() => void toggleLike(c)}
              />
            ))}
          </ul>
          <button
            type="button"
            className="mt-3 w-full rounded-xl border border-silver bg-paper px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-paper/60"
            onClick={() => setOpen(true)}
          >
            View all {items.length} comments
          </button>
        </>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" ref={dialogRef}>
          <div className="animate-overlay-in absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/60" onClick={() => close()} aria-hidden />
          <div className="animate-panel-in card relative flex max-h-[80vh] w-full max-w-lg flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg max-md:text-base font-semibold text-ink">Comments</h2>
                <p className="mt-1 text-sm text-slate">{items.length} total</p>
              </div>
              <button type="button" onClick={() => close()} disabled={busy} className="btn btn-ghost btn-sm" aria-label="Close">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>

            {items.length > 0 ? (
              <ul className="mt-4 flex-1 flex-col gap-3 space-y-3 overflow-y-auto pr-1">
                {items.map((c) => (
                  <CommentItem
                    key={c.id}
                    comment={c}
                    liked={!!(userId && (c.likedByUids ?? []).includes(userId))}
                    busy={likeBusy === c.id}
                    onToggle={() => void toggleLike(c)}
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-4 flex-1 text-sm text-slate">No comments yet. Start the conversation.</p>
            )}

            <form onSubmit={(e) => void post(e)} className="mt-4 flex gap-2 border-t border-silver pt-4">
              <input
                className="input flex-1"
                placeholder="Add a comment…"
                value={comment}
                maxLength={1000}
                disabled={busy}
                onChange={(e) => setComment(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !comment.trim()}>
                {busy ? "Posting…" : "Post"}
              </button>
            </form>
            {errorEl}
          </div>
        </div>
      )}
    </div>
  );
}
