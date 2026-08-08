"use client";

import { useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { api } from "@/lib/clientApi";
import { useToast } from "@/components/ui/Toast";
import { fileToCompressedBase64 } from "@/lib/upload";
import { ROLE_LABEL } from "@/lib/constants";
import { ROLES, type AnnouncementAudience, type Role } from "@/lib/types";

const MAX_IMAGES = 2;

export interface AnnouncementFormValue {
  title: string;
  body: string;
  /** `/api/images/{id}` URLs; up to 2, first is the thumbnail. */
  images: string[];
  audience: AnnouncementAudience;
}

interface Props {
  initial?: AnnouncementFormValue;
  submitLabel: string;
  busy?: boolean;
  onSubmit: (value: AnnouncementFormValue) => void | Promise<void>;
}

interface ImageEntry {
  url: string;
  preview: string;
  uploading?: boolean;
}

const LEADERSHIP_ROLES: Role[] = ["principal", "hod", "validator"];
const MAINTENANCE_ROLES: Role[] = ["maintenance"];

/** Audience preset chips (All roles / Leadership / Maintenance / Custom). */
export default function AnnouncementForm({ initial, submitLabel, busy, onSubmit }: Props) {
  const { showError } = useToast();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [images, setImages] = useState<ImageEntry[]>(
    (initial?.images ?? []).map((url) => ({ url, preview: url }))
  );
  const [kind, setKind] = useState<"all" | "roles">(
    initial?.audience.kind === "roles" ? "roles" : "all"
  );
  const [roles, setRoles] = useState<Role[]>(
    initial?.audience.kind === "roles" ? initial.audience.roles : []
  );

  const applyPreset = (key: "all" | "leadership" | "maintenance" | "custom") => {
    if (key === "all") {
      setKind("all");
      setRoles([]);
    } else if (key === "leadership") {
      setKind("roles");
      setRoles(LEADERSHIP_ROLES);
    } else if (key === "maintenance") {
      setKind("roles");
      setRoles(MAINTENANCE_ROLES);
    } else {
      setKind("roles");
      setRoles([]);
    }
  };

  const activePreset = (): "all" | "leadership" | "maintenance" | "custom" => {
    if (kind === "all") return "all";
    if (roles.length === LEADERSHIP_ROLES.length && LEADERSHIP_ROLES.every((r) => roles.includes(r))) {
      return "leadership";
    }
    if (roles.length === MAINTENANCE_ROLES.length && MAINTENANCE_ROLES.every((r) => roles.includes(r))) {
      return "maintenance";
    }
    return "custom";
  };

  const addImage = async (file: File) => {
    if (images.length >= MAX_IMAGES) return;
    const preview = URL.createObjectURL(file);
    setImages((prev) => [...prev, { url: "", preview, uploading: true }]);
    try {
      const base64 = await fileToCompressedBase64(file);
      const res = await api<{ url: string }>("/api/uploads", {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, mime: "image/jpeg", base64 }),
      });
      setImages((prev) => prev.map((im) => (im.preview === preview ? { ...im, url: res.url, uploading: false } : im)));
    } catch (e) {
      setImages((prev) => prev.filter((im) => im.preview !== preview));
      showError(e, { title: "Image upload failed" });
    }
  };

  const removeImage = (preview: string) => {
    setImages((prev) => prev.filter((im) => im.preview !== preview));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value: AnnouncementFormValue = {
      title,
      body,
      images: images.filter((im) => im.url).map((im) => im.url),
      audience: kind === "all" ? { kind: "all" } : { kind: "roles", roles },
    };
    void onSubmit(value);
  };

  const ready =
    title.trim().length >= 3 &&
    body.trim().length >= 1 &&
    !images.some((im) => im.uploading) &&
    !(kind === "roles" && roles.length === 0) &&
    !busy;

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="ann-title">
          Title
        </label>
        <input
          id="ann-title"
          className="input"
          placeholder="Title (e.g. Campus maintenance shutdown)"
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="ann-body">
          Description
        </label>
        <textarea
          id="ann-body"
          className="input min-h-[96px] resize-y"
          placeholder="Message for your audience…"
          required
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      <div>
        <p className="label mb-0">Images (optional)</p>
        <div className="mt-2 flex flex-wrap items-start gap-3">
          {images.map((im) => (
            <div
              key={im.preview}
              className="relative flex items-center justify-center rounded-xl border border-silver bg-paper px-2 py-1.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={im.preview}
                alt="Announcement preview"
                className="max-h-[120px] w-auto max-w-full rounded-lg object-contain"
              />
              {im.uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70">
                  <Loader2 className="h-6 w-6 animate-spin text-slate" aria-hidden />
                </div>
              )}
              <button
                type="button"
                aria-label="Remove image"
                className="absolute right-1 top-1 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-ink/80 text-white"
                onClick={() => removeImage(im.preview)}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate bg-paper px-4 py-4 text-slate transition-colors hover:border-graphite hover:text-graphite">
              <ImagePlus className="h-6 w-6" aria-hidden />
              <span className="text-xs font-medium">{images.length}/2 upload</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void addImage(file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      </div>

      <div>
        <p className="label">Audience</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "all", label: "All roles" },
              { key: "leadership", label: "Leadership" },
              { key: "maintenance", label: "Maintenance" },
              { key: "custom", label: "Custom…" },
            ] as const
          ).map((p) => (
            <button
              key={p.key}
              type="button"
              className={`tag ${activePreset() === p.key ? "bg-ink text-white" : "tag-outline"}`}
              onClick={() => applyPreset(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-slate">
          Leadership = Principal · HOD · Dept validators
        </p>
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
        <button type="submit" disabled={!ready} className="btn btn-primary btn-sm">
          {busy ? "Saving…" : submitLabel}
        </button>
        {kind === "roles" && roles.length === 0 && (
          <p className="text-xs text-[#c0392b]">Pick at least one role.</p>
        )}
      </div>
    </form>
  );
}
