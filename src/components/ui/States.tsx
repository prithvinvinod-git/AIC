import type { ReactNode } from "react";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-silver border-t-ink" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({ icon, title, body }: { icon?: ReactNode; title: string; body?: string }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 py-16 text-center">
      {icon && <div className="text-slate">{icon}</div>}
      <p className="font-medium text-graphite">{title}</p>
      {body && <p className="max-w-sm text-sm text-slate">{body}</p>}
    </div>
  );
}
