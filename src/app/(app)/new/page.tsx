"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api, ApiError } from "@/lib/clientApi";
import { BUILDINGS, COLLEGES, DEFAULT_FLOORS, DEPARTMENTS_BY_COLLEGE, PRIORITY_COLOR, PRIORITY_LABEL, type College } from "@/lib/constants";
import type { Category, ImageRef } from "@/lib/types";

const MAX_IMAGES = 3;

// Downscale + re-encode to JPEG on the client so blobs stay under the
// Firestore 1MB document limit (~300-600KB typical output at this size).
function fileToCompressedBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const img = new Image();
      img.onload = () => {
        const maxDim = 1600;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl.split(",")[1] || "");
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.8).split(",")[1] || "");
      };
      img.onerror = () => resolve(dataUrl.split(",")[1] || "");
      img.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function NewIssuePage() {
  const { claims } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [college, setCollege] = useState<College>(
    claims?.college && COLLEGES.includes(claims.college as College)
      ? (claims.college as College)
      : COLLEGES[0]
  );
  const [department, setDepartment] = useState(
    claims?.department && DEPARTMENTS_BY_COLLEGE[college].includes(claims.department)
      ? claims.department
      : DEPARTMENTS_BY_COLLEGE[college][0]
  );
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState(3);
  const [building, setBuilding] = useState(BUILDINGS[0]);
  const [floor, setFloor] = useState(DEFAULT_FLOORS[0]);
  const [locationName, setLocationName] = useState("");
  const [images, setImages] = useState<{ url: string; preview: string; uploading: boolean }[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<{ categories: Category[] }>("/api/categories")
      .then((res) => {
        setCategories(res.categories);
        if (!categoryId && res.categories.length) setCategoryId(res.categories[0].id || "");
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addImage = useCallback(async (file: File) => {
    if (images.length >= MAX_IMAGES) return;
    const preview = URL.createObjectURL(file);
    const entry = { url: "", preview, uploading: true };
    setImages((prev) => [...prev, entry]);
    try {
      const base64 = await fileToCompressedBase64(file);
      const res = await api<{ url: string }>("/api/uploads", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          mime: "image/jpeg",
          base64,
        }),
      });
      setImages((prev) => prev.map((im) => (im.preview === preview ? { ...im, url: res.url, uploading: false } : im)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed.");
      setImages((prev) => prev.filter((im) => im.preview !== preview));
    }
  }, [images.length]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setBusy(true);
      try {
        const pendingUpload = images.some((im) => im.uploading);
        if (pendingUpload) throw new ApiError("Please wait for image uploads to finish.", 400);
        const res = await api<{ issue: { id: string } }>("/api/issues", {
          method: "POST",
          body: JSON.stringify({
            title,
            description,
            college,
            department,
            categoryId,
            priority,
            location: {
              building,
              floor,
              name: locationName || `${building}${floor === "Ground" ? "" : `, Floor ${floor}`}`,
            },
            images: images.filter((im) => im.url).map((im): ImageRef => ({
              url: im.url,
              uploadedBy: claims?.name || "",
              at: new Date().toISOString(),
            })),
          }),
        });
        router.push(`/issues/${res.issue.id}`);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to submit issue.");
        setBusy(false);
      }
    },
    [title, description, college, department, categoryId, priority, building, floor, locationName, images, router, claims]
  );

  return (
    <div className="mx-auto max-w-[680px]">
      <h1 className="font-display text-2xl font-semibold text-ink">Report an issue</h1>
      <p className="mt-1 text-sm text-slate">
        Describe what needs attention. AI will suggest a category and verify priority during validation.
      </p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
        <div>
          <label className="label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            required
            maxLength={120}
            className="input"
            placeholder="Broken AC in Lab 3"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            required
            rows={4}
            maxLength={2000}
            className="input resize-none"
            placeholder="What happened, since when, and does it look urgent?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              required
              className="input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="college">
              College
            </label>
            <select
              id="college"
              className="input"
              value={college}
              onChange={(e) => {
                const c = e.target.value as College;
                setCollege(c);
                setDepartment(DEPARTMENTS_BY_COLLEGE[c][0]);
              }}
            >
              {COLLEGES.map((c) => (
                <option key={c} value={c}>
                  {c} College
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="department">
              Department
            </label>
            <select
              id="department"
              className="input"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              {DEPARTMENTS_BY_COLLEGE[college].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Priority</label>
          <div className="flex flex-wrap gap-2">
            {([1, 2, 3, 4, 5] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                aria-pressed={priority === p}
                className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors ${
                  priority === p
                    ? "border-ink bg-ink text-white"
                    : "border-silver bg-white text-graphite hover:border-graphite"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: priority === p ? "#fff" : PRIORITY_COLOR[p] }}
                  aria-hidden
                />
                {p} · {PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate">1 = Critical, 5 = Minor. Validators can adjust this later.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="building">
              Building
            </label>
            <select
              id="building"
              className="input"
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
            >
              {BUILDINGS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="floor">
              Floor
            </label>
            <select
              id="floor"
              className="input"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
            >
              {DEFAULT_FLOORS.map((f) => (
                <option key={f} value={f}>
                  {f === "Ground" ? "Ground" : `Floor ${f}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="room">
              Room / landmark
            </label>
            <input
              id="room"
              className="input"
              placeholder="Lab 3, near window"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">Photos</label>
          <div className="flex flex-wrap gap-3">
            {images.map((im, i) => (
              <div key={im.preview} className="relative h-20 w-20 overflow-hidden rounded-xl border border-silver">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.preview} alt="Issue preview" className="h-full w-full object-cover" />
                {im.uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                    <Loader2 className="h-4 w-4 animate-spin text-slate" aria-hidden />
                  </div>
                )}
                <button
                  type="button"
                  aria-label="Remove image"
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/80 text-white"
                  onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate text-slate transition-colors hover:border-graphite hover:text-graphite">
                <ImagePlus className="h-5 w-5" aria-hidden />
                <span className="text-[11px]">Add</span>
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

        {error && <p className="rounded-lg bg-[#fef2f2] px-3 py-2 text-sm text-[#c0392b]">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" className="btn btn-secondary" onClick={() => router.push("/dashboard")}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? "Submitting…" : "Submit issue"}
          </button>
        </div>
      </form>
    </div>
  );
}
