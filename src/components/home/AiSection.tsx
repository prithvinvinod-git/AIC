import {
  Brain,
  FileSearch,
  MapPin,
  Route,
  ScanEye,
  Sparkles,
  TrendingUp,
} from "lucide-react";

const AI_FEATURES = [
  {
    icon: ScanEye,
    title: "AI triage",
    body: "On every report, AI suggests the category and priority before a validator confirms them.",
  },
  {
    icon: MapPin,
    title: "At-risk location analysis",
    body: "Patterns across locations are analysed to surface buildings and zones at risk of repeat failures.",
  },
  {
    icon: Route,
    title: "Smart routing",
    body: "The model picks the most relevant team and staff for each issue based on its description.",
  },
  {
    icon: Sparkles,
    title: "Spam & photo safety",
    body: "Low-effort or unsafe reports are flagged automatically before they hit the queue.",
  },
  {
    icon: FileSearch,
    title: "Closure reports",
    body: "Completion and verification are summarised into concise, structured reports.",
  },
  {
    icon: TrendingUp,
    title: "Insights & forecasting",
    body: "Weekly insights, at-risk locations and root-cause analysis surface patterns for leadership.",
  },
];

/** Static band describing the AI-implemented features in the app. */
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
        <h2 className="mt-3 font-display text-2xl max-md:text-xl font-semibold text-ink">What AI does for you</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate">
          Every step that can be automated is — here is exactly what is implemented with AI in this
          app.
        </p>

        <div className="mt-8 grid gap-4 max-md:gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AI_FEATURES.map((f) => (
            <div key={f.title} className="card">
              <span className="flex h-14 w-14 max-md:h-12 max-md:w-12 items-center justify-center rounded-xl bg-paper text-graphite">
                <f.icon className="h-7 w-7" aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-base font-medium text-graphite">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
