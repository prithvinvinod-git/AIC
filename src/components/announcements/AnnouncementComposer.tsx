"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api, ApiError } from "@/lib/clientApi";
import { ROLE_LABEL } from "@/lib/constants";
import { ROLES, type Announcement, type Role } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { EmptyState, Loading } from "@/components/ui/States";

/**
 * Announcement composer + recent list. Shown to admins (as a tab), and to
 * principals / HODs on their home pages. Publishing goes through
 * POST /api/announcements, which fans out an `announcement` notification.
 */
export default function AnnouncementComposer() {
  const { claims } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"all" | "roles">("all");
  const [roles, setRoles] = useState<Role[]>([]);
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ announcements: Announcement[] }>("/api/announcements");
      setItems(res.announcements);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load announcements.");
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const publish = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setNotice(null);
      if (kind === "roles" && roles.length === 0) {
        setError("Pick at least one role, or choose Everyone.");
        return;
      }
      setBusy(true);
      try {
        await api("/api/announcements", {
          method: "POST",
          body: JSON.stringify({
            title,
            body,
            audience: kind === "all" ? { kind: "all" } : { kind: "roles", roles },
          }),
        });
        setTitle("");
        setBody("");
        setKind("all");
        setRoles([]);
        setNotice("Announcement published to the notification feed.");
        await load();
      } catch (e2) {
        setError(e2 instanceof ApiError ? e2.message : "Failed to publish announcement.");
      } finally {
        setBusy(false);
      }
    },
    [title, body, kind, roles, load]
  );

  if (!claims) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-[#7c3aed]" aria-hidden />
        <h2 className="font-display text-lg font-semibold text-ink">Announcements</h2>
      </div>

      <form onSubmit={publish} className="card flex flex-col gap-3">
        {error && <p className="rounded-lg bg-[#fef2f2] px-3 py-2 text-sm text-[#c0392b]">{error}</p>}

        <input
          className="input"
          placeholder="Title (e.g. Campus maintenance shutdown)"
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="input min-h-[96px] resize-y"
          placeholder="Message for your audience…"
          required
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        <div>
          <p className="label">Audience</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`tag ${kind === "all" ? "bg-ink text-white" : "tag-outline"}`}
              onClick={() => setKind("all")}
            >
              Everyone
            </button>
            <button
              type="button"
              className={`tag ${kind === "roles" ? "bg-ink text-white" : "tag-outline"}`}
              onClick={() => setKind("roles")}
            >
              Specific roles
            </button>
          </div>
        </div>

        {kind === "roles" && (
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => {
              const checked = roles.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  className={`tag ${checked ? "bg-ink text-white" : "tag-outline"}`}
                  onClick={() =>
                    setRoles((prev) => (checked ? prev.filter((x) => x !== r) : [...prev, r]))
                  }
                >
                  {ROLE_LABEL[r]}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
            {busy ? "Publishing…" : "Publish"}
          </button>
          {notice && <p className="text-sm text-[#2e7d32]">{notice}</p>}
        </div>
      </form>

      {items === null ? (
        <div className="card p-4">
          <Loading label="Loading announcements…" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-8 w-8" aria-hidden />}
          title="No announcements yet"
          body="Published broadcasts will appear here."
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <ul className="divide-y divide-silver">
            {items.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-graphite">{a.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate">{a.body}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate">
                    <p>{formatDateTime(a.createdAt)}</p>
                    <p className="mt-1">
                      {a.author?.name}
                      {a.author?.role ? ` · ${ROLE_LABEL[a.author.role]}` : ""}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
