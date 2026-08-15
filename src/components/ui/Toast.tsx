"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { ApiError } from "@/lib/clientApi";

type ToastType = "error" | "info" | "success";

const MAX_TOASTS = 4;

const EXIT_MS = 220;

const DEFAULT_DURATION: Record<ToastType, number> = {
  error: 8000,
  info: 5000,
  success: 5000,
};

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message: string;
  duration: number;
  link?: string;
  leaving?: boolean;
}

export interface ToastOptions {
  title: string;
  message: string;
  type?: ToastType;
  duration?: number;
  link?: string;
}

interface ToastContextValue {
  show: (opts: ToastOptions) => void;
  showError: (err: unknown, opts?: Partial<Pick<ToastOptions, "title" | "type">>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, { Icon: typeof TriangleAlert; chip: string }> = {
  error: { Icon: TriangleAlert, chip: "bg-danger-soft text-danger" },
  info: { Icon: Info, chip: "bg-accent-soft text-accent" },
  success: { Icon: CircleCheck, chip: "bg-success-soft text-success" },
};

/** Turn any thrown value (ApiError with server validation details, etc.) into a readable toast. */
function formatError(err: unknown): { title: string; message: string } {
  if (typeof err === "string") {
    return { title: "Something went wrong", message: err };
  }
  if (err instanceof ApiError) {
    const body = err.details as
      | { details?: { path: string; message: string }[] }
      | { path: string; message: string }[]
      | null
      | undefined;
    const issues = Array.isArray(body) ? body : Array.isArray(body?.details) ? body.details : [];
    if (issues.length) {
      return {
        title: "Please check the form",
        message: issues.map((i) => `• ${i.message}${i.path ? ` (${i.path})` : ""}`).join("\n"),
      };
    }
    return { title: "Something went wrong", message: err.message };
  }
  return {
    title: "Something went wrong",
    message: err instanceof Error ? err.message : "Something unexpected happened.",
  };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const beginLeave = useCallback(
    (id: number) => {
      setToasts((prev) => (prev.some((t) => t.id === id && !t.leaving) ? prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)) : prev));
      window.setTimeout(() => dismiss(id), EXIT_MS);
    },
    [dismiss]
  );

  const show = useCallback((opts: ToastOptions) => {
    const id = ++idRef.current;
    const type = opts.type ?? "error";
    setToasts((prev) => [
      ...prev.slice(-(MAX_TOASTS - 1)),
      {
        id,
        type,
        title: opts.title,
        message: opts.message,
        duration: opts.duration ?? DEFAULT_DURATION[type],
        link: opts.link,
      },
    ]);
  }, []);

  const showError = useCallback(
    (err: unknown, opts?: Partial<Pick<ToastOptions, "title" | "type">>) => {
      const { title, message } = formatError(err);
      show({ title: opts?.title ?? title, message, type: opts?.type ?? "error" });
    },
    [show]
  );

  // Console demo hook: `window.__toast.success("…")` etc. from the browser
  // devtools. Keep the show functions attached so any console script can drive
  // the real toast renderer.
  useEffect(() => {
    const w = window as unknown as {
      __toast?: {
        show: (opts: ToastOptions) => void;
        error: (message: string, title?: string) => void;
        info: (message: string, title?: string) => void;
        success: (message: string, title?: string) => void;
      };
    };
    w.__toast = {
      show,
      error: (message, title = "Demo error") => show({ title, message, type: "error" }),
      info: (message, title = "Demo info") => show({ title, message, type: "info" }),
      success: (message, title = "Demo success") => show({ title, message, type: "success" }),
    };
    return () => {
      delete w.__toast;
    };
  }, [show, showError]);

  return (
    <ToastContext.Provider value={{ show, showError }}>
      {children}
      <div
        className="pointer-events-none fixed right-5 top-[68px] z-[60] flex w-[360px] max-w-[calc(100vw-2.5rem)] flex-col items-end gap-2.5 sm:top-[90px]"
        aria-live="assertive"
      >
        {toasts.map((t) => {
          const { Icon, chip } = ICONS[t.type];
          return (
            <div
              key={t.id}
              role={t.type === "error" ? "alert" : "status"}
              className={`toast-slot pointer-events-auto w-full ${
                t.leaving ? "animate-toast-out-right" : "animate-toast-in-right"
              }`}
            >
              <div
                className={`flex w-full items-start gap-2.5 rounded-xl border border-silver bg-white p-3 shadow-card transition-shadow hover:shadow-[var(--shadow-card-hover)] ${
                  t.link ? "cursor-pointer" : ""
                }`}
                onClick={
                  t.link
                    ? (e) => {
                        e.preventDefault();
                        beginLeave(t.id);
                        router.push(t.link as string);
                      }
                    : undefined
                }
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${chip}`}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{t.title}</p>
                  {t.message && (
                    <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-slate">{t.message}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    beginLeave(t.id);
                  }}
                  className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-stone transition-colors hover:text-ink"
                  aria-label="Dismiss"
                >
                  <svg
                    className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
                    viewBox="0 0 32 32"
                    aria-hidden
                  >
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray="88"
                      className="toast-ring text-slate"
                      style={{ animationDuration: `${t.duration}ms` } as CSSProperties}
                      onAnimationEnd={() => beginLeave(t.id)}
                    />
                  </svg>
                  <X className="relative h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Toast-bound error helper for cards. Returns a `showError` setter plus an
 * `errorEl` that renders nothing, so cards can drop their inline error text:
 * replace `setError(...)` with `showError(...)` and `{error && <p>…</p>}` with `{errorEl}`.
 */
export function useActionError(): { showError: ToastContextValue["showError"]; errorEl: null } {
  const { showError } = useToast();
  return { showError, errorEl: null };
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
