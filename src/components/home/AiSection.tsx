import dynamic from "next/dynamic";
import {
  Brain,
  FileSearch,
  MapPin,
  Route,
  ScanEye,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { CardData } from "@/components/ui/morphing-card-stack";

const MorphingCardStack = dynamic(
  () => import("@/components/ui/morphing-card-stack").then((m) => m.MorphingCardStack),
  { ssr: false }
);

const AI_FEATURES: CardData[] = [
  {
    id: "triage",
    title: "AI triage",
    description: "On every report, AI suggests the category and priority before a validator confirms them.",
    icon: <ScanEye className="h-7 w-7 max-md:h-5 max-md:w-5" aria-hidden />,
  },
  {
    id: "at-risk",
    title: "At-risk location analysis",
    description: "Patterns across locations are analysed to surface buildings and zones at risk of repeat failures.",
    icon: <MapPin className="h-7 w-7 max-md:h-5 max-md:w-5" aria-hidden />,
  },
  {
    id: "routing",
    title: "Smart routing",
    description: "The model picks the most relevant team and staff for each issue based on its description.",
    icon: <Route className="h-7 w-7 max-md:h-5 max-md:w-5" aria-hidden />,
  },
  {
    id: "spam",
    title: "Spam & photo safety",
    description: "Low-effort or unsafe reports are flagged automatically before they hit the queue.",
    icon: <Sparkles className="h-7 w-7 max-md:h-5 max-md:w-5" aria-hidden />,
  },
  {
    id: "closure",
    title: "Closure reports",
    description: "Completion and verification are summarised into concise, structured reports.",
    icon: <FileSearch className="h-7 w-7 max-md:h-5 max-md:w-5" aria-hidden />,
  },
  {
    id: "insights",
    title: "Insights & forecasting",
    description: "Weekly insights, at-risk locations and root-cause analysis surface patterns for leadership.",
    icon: <TrendingUp className="h-7 w-7 max-md:h-5 max-md:w-5" aria-hidden />,
  },
];

/** Static band describing the AI-implemented features in the app.
 *  Mobile: MorphingCardStack (stack/grid/list). Desktop: original grid. */
export default function AiSection() {
  return (
    <section id="ai" className="scroll-mt-24 border-y border-silver bg-paper/60">
      <div className="mx-auto w-full max-w-page px-[20px] py-12 sm:px-6">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-accent" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">
            Powered by AI
          </span>
        </div>
        <h2 className="mt-3 font-display text-2xl max-md:text-xl font-semibold text-ink">
          What AI does for you
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate">
          Every step that can be automated is — here is exactly what is implemented with AI in this
          app.
        </p>

        {/* Mobile: morphing card stack */}
        <div className="mt-8 max-md:block hidden">
          <MorphingCardStack cards={AI_FEATURES} defaultLayout="stack" />
        </div>

        {/* Desktop: original grid */}
        <div className="mt-8 max-md:hidden grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AI_FEATURES.map((f) => (
            <div key={f.id} className="card">
              <div className="flex items-center gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-accent">
                  {f.icon}
                </span>
                <h3 className="font-display text-base font-medium text-graphite">{f.title}</h3>
              </div>
              <p className="mt-1.5 text-sm text-slate">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
