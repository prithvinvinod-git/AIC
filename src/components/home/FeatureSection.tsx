const STEPS = [
  { n: "01", t: "Report", d: "Anyone raises an issue with photo and location." },
  { n: "02", t: "Validate", d: "Department validator triages category and priority." },
  { n: "03", t: "Escalate", d: "Critical issues reach HOD and the Principal for approval." },
  { n: "04", t: "Execute", d: "Validator routes work to teams; staff log requirements and progress." },
  { n: "05", t: "Verify", d: "Reporter rates the outcome and the validator verifies work done." },
];

export default function FeatureSection() {
  return (
    <section id="how-it-works" className="mx-auto w-full max-w-page scroll-mt-24 px-[20px] py-12 sm:px-6">
      <h2 className="font-display text-2xl max-md:text-xl font-semibold text-ink">How it works</h2>
      <div className="mt-6 grid gap-4 max-md:gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((s) => (
          <div key={s.n} className="card">
            <p className="font-display text-sm font-semibold text-accent">{s.n}</p>
            <h3 className="mt-2 font-medium text-graphite">{s.t}</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate">{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
