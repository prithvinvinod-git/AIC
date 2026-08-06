import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  Gauge,
  HardHat,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

const FEATURES = [
  {
    icon: ClipboardList,
    title: "Report in 60 seconds",
    body: "Describe the problem, snap a photo, and AI instantly classifies category and priority.",
  },
  {
    icon: Workflow,
    title: "Closed-loop workflow",
    body: "Every issue moves through a governed state machine — validate, escalate, approve, assign, execute, verify, close.",
  },
  {
    icon: Gauge,
    title: "SLA enforcement",
    body: "Response and resolution deadlines per priority, with breach tracking and overdue boards.",
  },
  {
    icon: Sparkles,
    title: "AI that suggests",
    body: "Triage, duplicate detection, routing, requirements and closure reports — the machine always decides.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based control",
    body: "Separate views for reporters, department validators, HODs, the Principal and maintenance teams.",
  },
  {
    icon: HardHat,
    title: "Verify before close",
    body: "Reporter feedback and maintenance-head verification gate the final close of every ticket.",
  },
];

const STEPS = [
  { n: "01", t: "Report", d: "Anyone raises an issue with photo and location." },
  { n: "02", t: "Validate", d: "Department validator triages category and priority." },
  { n: "03", t: "Escalate", d: "Critical issues reach HOD and the Principal for approval." },
  { n: "04", t: "Execute", d: "Maintenance head routes work; teams log requirements and progress." },
  { n: "05", t: "Verify", d: "Reporter rates the outcome and the head verifies work done." },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-silver bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1100px] items-center justify-between px-6">
          <div className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink text-white">
              <HardHat className="h-4 w-4" aria-hidden />
            </span>
            CampusCare
          </div>
          <nav className="flex items-center gap-3">
            <Link href="/login" className="btn btn-ghost btn-sm">
              Sign in
            </Link>
            <Link href="/signup" className="btn btn-primary btn-sm">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-[1100px] px-6 pt-20 pb-16 text-center">
          <span className="tag bg-ink text-white">Campus maintenance, reimagined</span>
          <h1 className="mx-auto mt-5 max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            Report it once.
            <br />
            Watch it close.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate">
            A governed, AI-assisted workflow for professional campus upkeep — from a leak in Block&nbsp;C
            to a full electrical audit.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="btn btn-primary btn-lg">
              Report your first issue <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/login" className="btn btn-secondary btn-lg">
              Explore demo accounts
            </Link>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1100px] px-6 py-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-paper text-graphite">
                  <f.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-display text-base font-medium text-graphite">{f.title}</h3>
                <p className="mt-1.5 text-sm text-slate">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1100px] px-6 py-12">
          <h2 className="font-display text-2xl font-semibold text-ink">How it works</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((s) => (
              <div key={s.n} className="card">
                <p className="font-display text-sm font-semibold text-action-blue">{s.n}</p>
                <h3 className="mt-2 font-medium text-graphite">{s.t}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate">{s.d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-silver bg-white">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col items-center justify-between gap-3 px-6 py-6 text-sm text-slate sm:flex-row">
          <p>© {new Date().getFullYear()} CampusCare</p>
          <p>Built for professional campus teams.</p>
        </div>
      </footer>
    </div>
  );
}
