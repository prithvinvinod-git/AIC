"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { ApiError } from "@/lib/clientApi";

type ToastType = "error" | "info" | "success";

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message: string;
}

export interface ToastOptions {
  title: string;
  message: string;
  type?: ToastType;
}

interface ToastContextValue {
  show: (opts: ToastOptions) => void;
  showError: (err: unknown, opts?: Partial<Pick<ToastOptions, "title" | "type">>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, { Icon: typeof TriangleAlert; color: string }> = {
  error: { Icon: TriangleAlert, color: "text-danger" },
  info: { Icon: Info, color: "text-accent" },
  success: { Icon: CircleCheck, color: "text-emerald-600" },
};

/** Turn any thrown value (ApiError with server validation details, etc.) into a readable toast. */
function formatError(err: unknown): { title: string; message: string } {
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
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (opts: ToastOptions) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-2), { id, type: opts.type ?? "error", title: opts.title, message: opts.message }]);
      window.setTimeout(() => dismiss(id), 6000);
    },
    [dismiss]
  );

  const showError = useCallback(
    (err: unknown, opts?: Partial<Pick<ToastOptions, "title" | "type">>) => {
      const { title, message } = formatError(err);
      show({ title: opts?.title ?? title, message, type: opts?.type ?? "error" });
    },
    [show]
  );

  return (
    <ToastContext.Provider value={{ show, showError }}>
      {children}
      <div
        className="pointer-events-none fixed left-1/2 top-4 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4"
        role="status"
      >
        {toasts.map((t) => {
          const { Icon, color } = ICONS[t.type];
          return (
            <div
              key={t.id}
              className="animate-toast-in pointer-events-auto flex items-start gap-2.5 rounded-xl border border-silver bg-white p-3 shadow-card"
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                {t.message && (
                  <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-slate">{t.message}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="text-stone transition-colors hover:text-ink"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
