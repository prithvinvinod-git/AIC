"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from "react";
import { Megaphone, Pencil, ShieldAlert, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/clientApi";
import { useToast } from "@/components/ui/Toast";
import { Loading, EmptyState } from "@/components/ui/States";
import AnnouncementForm, { type AnnouncementFormValue } from "@/components/announcements/AnnouncementForm";
import { ROLE_LABEL } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { Announcement, AnnouncementAudience, Role } from "@/lib/types";

const ANNOUNCER_ROLES: Role[] = ["admin", "principal", "hod"];

function audienceLabel(a: AnnouncementAudience): string {
  if (a.kind === "all") return "All roles";
  return a.roles.map((r) => ROLE_LABEL[r as Role]).join(", ");
}

export default function AnnouncementsPage() {
  const { claims } = useAuth();
  const { show, showError } = useToast();

  const [items, setItems] = useState<Announcement[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const editDialogRef = useRef<HTMLDivElement | null>(null);
  const deleteDialogRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(editDialogRef, editing !== null);
  useFocusTrap(deleteDialogRef, deleting !== null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const res = await api<{ announcements: Announcement[] }>("/api/announcements");
      setItems(res.announcements);
    } catch (e) {
      setLoadFailed(true);
      setItems([]);
      showError(e, { title: "Couldn't load announcements" });
    }
  }, [showError]);

  useEffect(() => {
    void load();
  }, [load]);

  const publish = useCallback(
    async (value: AnnouncementFormValue) => {
      setPublishing(true);
      try {
        await api("/api/announcements", {
          method: "POST",
          body: JSON.stringify(value),
        });
        show({ type: "success", title: "Announcement published", message: "Your audience was notified." });
        await load();
      } catch (e) {
        showError(e, { title: "Couldn't publish announcement" });
      } finally {
        setPublishing(false);
      }
    },
    [load, show, showError]
  );

  const saveEdit = useCallback(
    async (value: AnnouncementFormValue) => {
      if (!editing?.id) return;
      setSavingEdit(true);
      try {
        await api(`/api/announcements/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(value),
        });
        show({ type: "success", title: "Announcement updated", message: "Changes saved." });
        setEditing(null);
        await load();
      } catch (e) {
        showError(e, { title: "Couldn't update announcement" });
      } finally {
        setSavingEdit(false);
      }
    },
    [editing, load, show, showError]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleting?.id) return;
    setDeletingBusy(true);
    try {
      await api(`/api/announcements/${deleting.id}`, { method: "DELETE" });
      show({ type: "success", title: "Announcement deleted", message: "It was removed from the list." });
      setDeleting(null);
      await load();
    } catch (e) {
      showError(e, { title: "Couldn't delete announcement" });
    } finally {
      setDeletingBusy(false);
    }
  }, [deleting, load, show, showError]);

  if (!claims) return null;
  if (!ANNOUNCER_ROLES.includes(claims.role)) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-8 w-8" aria-hidden />}
        title="Role restricted"
        body="Admins, the Principal and HODs manage campus announcements."
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Announcements</h1>
        <p className="mt-1 text-sm text-slate">
          Broadcast notices to everyone or to specific roles — they land in the recipients&apos; notification feeds.
        </p>
      </div>

      <section className="card flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-violet" aria-hidden />
          <h2 className="font-display text-lg font-semibold text-ink">New announcement</h2>
        </div>
        <AnnouncementForm submitLabel="Publish" busy={publishing} onSubmit={publish} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-semibold text-ink">Live announcements</h2>

        {items === null ? (
          <Loading label="Loading announcements…" />
        ) : items.length === 0 ? (
          loadFailed ? (
            <div className="card flex flex-col items-start gap-3">
              <p className="text-sm text-slate">Couldn&apos;t load announcements.</p>
              <button className="btn btn-ghost btn-sm" onClick={() => void load()}>
                Retry
              </button>
            </div>
          ) : (
            <EmptyState
              icon={<Megaphone className="h-8 w-8" aria-hidden />}
              title="No announcements yet"
              body="Published broadcasts will appear here."
            />
          )
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((a) => (
              <article key={a.id} className="card overflow-hidden p-0">
                <div className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-semibold text-ink">{a.title}</h3>
                      <p className="mt-0.5 text-sm text-slate">{a.body}</p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-slate">
                      <p>{formatDateTime(a.createdAt)}</p>
                      <p className="mt-1">
                        {a.author?.name}
                        {a.author?.role ? ` · ${ROLE_LABEL[a.author.role]}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="tag tag-outline">{audienceLabel(a.audience)}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditing(a)}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-danger"
                        onClick={() => setDeleting(a)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" ref={editDialogRef}>
          <div
            className="animate-overlay-in absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => !savingEdit && setEditing(null)}
            aria-hidden
          />
          <div className="animate-panel-in card relative max-h-[90vh] w-full max-w-lg overflow-y-auto">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">Edit announcement</h2>
                <p className="mt-1 text-sm text-slate">
                  Changes are saved to the announcement; only newly added audience members are notified.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => !savingEdit && setEditing(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <AnnouncementForm
              initial={{
                title: editing.title,
                body: editing.body,
                images: editing.images ?? [],
                audience: editing.audience,
              }}
              submitLabel="Save changes"
              busy={savingEdit}
              onSubmit={saveEdit}
            />
          </div>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label="Delete announcement" ref={deleteDialogRef}>
          <div
            className="animate-overlay-in absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => !deletingBusy && setDeleting(null)}
            aria-hidden
          />
          <div className="animate-panel-in card relative w-full max-w-md">
            <h2 className="font-display text-lg font-semibold text-ink">Delete announcement?</h2>
            <p className="mt-1 text-sm text-slate">
              “{deleting.title}” will be removed. Notifications already delivered to users stay in their feeds.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => !deletingBusy && setDeleting(null)}
                disabled={deletingBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void confirmDelete()}
                disabled={deletingBusy}
              >
                {deletingBusy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
