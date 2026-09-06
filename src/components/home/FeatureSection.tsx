import dynamic from "next/dynamic";
import type { CardData } from "@/components/ui/morphing-card-stack";

const MorphingCardStack = dynamic(
  () => import("@/components/ui/morphing-card-stack").then((m) => m.MorphingCardStack),
  { ssr: false }
);

const STEPS: CardData[] = [
  {
    id: "report",
    title: "Report",
    description: "Anyone raises an issue with photo and location.",
    icon: <span className="font-display text-sm font-bold text-accent">01</span>,
  },
  {
    id: "validate",
    title: "Validate",
    description: "Department validator triages category and priority.",
    icon: <span className="font-display text-sm font-bold text-accent">02</span>,
  },
  {
    id: "escalate",
    title: "Escalate",
    description: "Critical issues reach HOD and the Principal for approval.",
    icon: <span className="font-display text-sm font-bold text-accent">03</span>,
  },
  {
    id: "execute",
    title: "Execute",
    description: "Validator routes work to teams; staff log requirements and progress.",
    icon: <span className="font-display text-sm font-bold text-accent">04</span>,
  },
  {
    id: "verify",
    title: "Verify",
    description: "Reporter rates the outcome and the validator verifies work done.",
    icon: <span className="font-display text-sm font-bold text-accent">05</span>,
  },
];

/** Static band describing the maintenance workflow.
 *  Mobile: MorphingCardStack (stack/list). Desktop: original grid. */
export default function FeatureSection() {
  return (
    <section id="how-it-works" className="mx-auto w-full max-w-page scroll-mt-24 px-[20px] py-12 sm:px-6">
      <h2 className="font-display text-2xl max-md:text-xl font-semibold text-ink">How it works</h2>

      {/* Mobile: morphing card stack */}
      <div className="mt-8 max-md:block hidden">
        <MorphingCardStack cards={STEPS} defaultLayout="stack" hideDots />
      </div>

      {/* Desktop: original grid */}
      <div className="mt-6 grid gap-4 max-md:hidden max-md:gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((s) => (
          <div key={s.id} className="card">
            <p className="font-display text-sm font-semibold text-accent">{s.icon}</p>
            <h3 className="mt-2 font-medium text-graphite">{s.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate">{s.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}