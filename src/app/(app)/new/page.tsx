"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import ProfileOnboarding from "@/components/auth/ProfileOnboarding";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/clientApi";
import { fileToCompressedBase64 } from "@/lib/upload";
import { BUILDINGS, COLLEGES, DEFAULT_FLOORS, DEPARTMENTS_BY_COLLEGE, PRIORITY_COLOR, PRIORITY_LABEL, type College } from "@/lib/constants";
import { assertRouteAccess } from "@/lib/roleGuards";
import type { Category, ImageRef } from "@/lib/types";

const MAX_IMAGES = 3;

export default function NewIssuePage() {
  const { claims } = useAuth();
  const router = useRouter();
  const { showError } = useToast();

  assertRouteAccess(claims, ["reporter"]);

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
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadCategories = useCallback(() => {
    void api<{ categories: Category[] }>("/api/categories")
      .then((res) => {
        setCategories(res.categories);
        setCategoryId((prev) => prev || res.categories[0]?.id || "");
        setCategoriesError(null);
      })
      .catch(() => setCategoriesError("Couldn't load categories. Please retry."));
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const c = claims?.college as College | undefined;
    if (c && COLLEGES.includes(c)) {
      setCollege(c);
      if (claims?.department && DEPARTMENTS_BY_COLLEGE[c].includes(claims.department)) {
        setDepartment(claims.department);
      }
    }
  }, [claims]);

  useEffect(() => {
    const previews = images.map((im) => im.preview);
    return () => previews.forEach((p) => URL.revokeObjectURL(p));
  }, [images]);

  const removeImage = useCallback((preview: string) => {
    URL.revokeObjectURL(preview);
    setImages((prev) => prev.filter((im) => im.preview !== preview));
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
      showError(e, { title: "Image upload failed" });
      URL.revokeObjectURL(preview);
      setImages((prev) => prev.filter((im) => im.preview !== preview));
    }
  }, [images.length, showError]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
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
        showError(err, { title: "Couldn't submit issue" });
        setBusy(false);
      }
    },
    [title, description, college, department, categoryId, priority, building, floor, locationName, images, router, claims, showError]
  );

  if (claims?.role === "reporter" && !claims.college) {
    return (
<div className="w-full max-w-[820px] sm:h-[calc(100vh-150px)] sm:overflow-y-auto sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
        <h1 className="font-display text-2xl max-md:text-xl font-semibold text-ink">Report an issue</h1>
        <p className="mt-1 text-sm text-slate">Add your college and department to your profile first.</p>
        <div className="mt-6">
          <ProfileOnboarding required inline />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[820px]">
      <h1 className="font-display text-2xl max-md:text-xl font-semibold text-ink">Report an issue</h1>
      <p className="mt-1 text-sm text-slate">
        Describe what needs attention. AI will suggest a category and verify priority during validation.
      </p>

      <div className="mt-6 grid items-start gap-6 sm:grid-cols-[1fr_280px]">
        <form id="issue-form" onSubmit={submit} className="flex flex-col gap-5">
        <div>
          <label className="label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            required
            minLength={5}
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
            minLength={10}
            rows={4}
            maxLength={2000}
            className="input resize-none"
            placeholder="What happened, since when, and does it look urgent?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:gap-6">
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
            {categoriesError && (
              <p className="mt-1 flex items-center gap-2 text-xs text-danger">
                {categoriesError}
                <button type="button" className="link-blue" onClick={() => void loadCategories()}>
                  Retry
                </button>
              </p>
            )}
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
        </div>

        <div className="grid gap-4 sm:grid-cols-3 md:gap-6">
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
        </form>

        <aside className="card mt-2.5 flex flex-col gap-3 pb-[32px] sm:mt-[20px]" style={{ boxShadow: "none", paddingTop: 18 }}>
          <p className="label mb-0">Photos</p>

          <div className="hidden flex-col gap-3 sm:flex">
            {Array.from({ length: MAX_IMAGES }).map((_, i) => {
              const im = images[i];
              if (im) {
                return (
                  <div
                    key={im.preview}
                    className="relative flex h-[124px] items-center justify-center rounded-xl border border-silver bg-paper"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={im.preview}
                      alt="Issue preview"
                      className="max-h-[92%] w-auto max-w-[92%] rounded-lg object-contain"
                    />
                    {im.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70">
                        <Loader2 className="h-6 w-6 animate-spin text-slate" aria-hidden />
                      </div>
                    )}
                    <button
                      type="button"
                      aria-label="Remove image"
                      className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-ink/80 text-white"
                      onClick={() => removeImage(im.preview)}
                    >
                      <X className="h-[18px] w-[18px]" aria-hidden />
                    </button>
                  </div>
                );
              }
              return (
                <label
                  key={`slot-${i}`}
                  className="flex h-[124px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate bg-paper text-slate transition-colors hover:border-graphite hover:text-graphite"
                >
                  <ImagePlus className="h-7 w-7" aria-hidden />
                  <span className="text-xs font-medium">Add photo</span>
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
              );
            })}
          </div>

          <div className="flex flex-col gap-4 sm:hidden">
            {images.map((im) => (
              <div
                key={im.preview}
                className="relative flex items-center justify-center rounded-xl border border-silver bg-paper px-2 py-1.5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={im.preview}
                  alt="Issue preview"
                  className="max-h-[142px] w-auto max-w-full rounded-lg object-contain"
                />
                {im.uploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70">
                    <Loader2 className="h-6 w-6 animate-spin text-slate" aria-hidden />
                  </div>
                )}
                <button
                  type="button"
                  aria-label="Remove image"
                  className="absolute right-1.5 top-1.5 flex h-[38px] w-[38px] items-center justify-center rounded-full bg-ink/80 text-white"
                  onClick={() => removeImage(im.preview)}
                >
                  <X className="h-[18px] w-[18px]" aria-hidden />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <label className="mt-2.5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate bg-paper px-4 py-5 text-slate transition-colors hover:border-graphite hover:text-graphite">
                <ImagePlus className="h-9 w-9" aria-hidden />
                <span className="text-sm font-medium">Upload photos</span>
                <span className="text-xs text-stone">
                  {images.length}/{MAX_IMAGES} · keeps original ratio
                </span>
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

          <p className="hidden text-xs text-stone sm:block">
            {images.length}/{MAX_IMAGES} · keeps original ratio
          </p>
        </aside>
      </div>

      <div className="mt-6 flex justify-end gap-3 sm:sticky sm:bottom-4 sm:z-10 sm:mt-1.5">
        <button type="button" className="btn btn-secondary" onClick={() => router.push("/dashboard")}>
          Cancel
        </button>
        <button type="submit" form="issue-form" className="btn btn-primary">
          {busy ? "Submitting…" : "Submit issue"}
        </button>
      </div>
    </div>
  );
}
