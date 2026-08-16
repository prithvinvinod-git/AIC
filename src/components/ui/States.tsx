import type { ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-slate">
      <div className="app-loader" role="status" aria-label="Loading">
        <span />
        <span />
        <span />
        <span />
      </div>
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

export function BoardErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 py-16 text-center">
      <AlertCircle className="h-8 w-8 text-danger" aria-hidden />
      <div>
        <p className="font-medium text-graphite">Couldn&apos;t load this board</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate">
          {message ?? "Check your connection and try again."}
        </p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-primary btn-sm">
          <RefreshCw className="mr-1.5 inline-block h-3.5 w-3.5" aria-hidden />
          Try again
        </button>
      )}
    </div>
  );
}
