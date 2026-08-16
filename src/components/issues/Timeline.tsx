import { Check } from "lucide-react";
import { STATUS_LABEL } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { TimelineEntry } from "@/lib/types";

const dotClass = (t: TimelineEntry): string => {
  if (!t.from) return "bg-danger";
  if (t.to === "ASSIGNED") return "bg-[#eab308]";
  if (t.to === "APPROVED") return "bg-warning";
  if (t.to === "CLOSED") return "bg-success";
  return t.isAuto ? "bg-accent" : "bg-ink";
};

export function Timeline({ timeline }: { timeline: TimelineEntry[] }) {
  return (
    <ol className="mt-4 flex flex-col gap-0 max-md:mt-2">
      {timeline.map((t, i) => {
        const isLast = i === timeline.length - 1;
        const isSpecial = t.to === "ASSIGNED" || t.to === "CLOSED";
        const showActive = isLast && !isSpecial;
        const checkClass = t.to === "ASSIGNED" ? "text-ink" : "text-white";
        return (
          <li key={i} className="relative flex gap-3 pb-5 last:pb-0 max-md:gap-2 max-md:pb-2">
            {!isLast && (
              <span
                className="absolute left-[5px] top-[12px] h-full w-px bg-silver max-md:left-[7px] max-md:top-[19px]"
                aria-hidden
              />
            )}
            <span
              className={`z-[1] mt-1.5 flex h-3 w-3 shrink-0 items-center justify-center rounded-full max-md:mt-[3px] max-md:h-4 max-md:w-4 ${
                showActive
                  ? `${dotClass(t)} max-md:border-2 max-md:border-accent max-md:bg-white`
                  : dotClass(t)
              }`}
            >
              {showActive ? (
                <span className="hidden text-[11px] font-semibold text-accent max-md:block">
                  {i + 1}
                </span>
              ) : (
                <Check
                  className={`h-2.5 w-2.5 ${checkClass} max-md:h-3 max-md:w-3`}
                  strokeWidth={3}
                  aria-hidden
                />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm max-md:text-xs">
                <span className="font-medium text-graphite">
                  {t.from ? STATUS_LABEL[t.from] : "Reported"} → {STATUS_LABEL[t.to]}
                </span>
                {t.isAuto && <span className="ml-1 text-xs text-accent">auto</span>}
              </p>
              <p className="mt-0.5 text-xs text-slate max-md:text-[11px]">
                {t.by?.name} · {formatDateTime(t.at)}
              </p>
              {t.note && <p className="mt-1 text-sm text-slate max-md:text-xs">{t.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
