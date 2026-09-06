const FAQS = [
  {
    q: "How do I report a maintenance issue?",
    a: "Sign in, open the Report an issue page and add a title, description, location and optional photos. AI scans the report and suggests a category and priority before a validator reviews it.",
  },
  {
    q: "Who decides what happens to my report?",
    a: "Every report is triaged by a department validator who confirms the category and priority. Critical issues are escalated to the HOD and Principal for approval before any work starts. AI only suggests — humans decide.",
  },
  {
    q: "How long will my issue take to fix?",
    a: "Service levels depend on priority. Critical issues have a 1 hour response and 24 hour resolution target, while minor issues allow up to 14 days. Deadlines pause whenever work is blocked pending approval.",
  },
  {
    q: "Can I track my issue after reporting?",
    a: "Yes. The reporter, the assigned team, validators and leadership all see a live status rail and full timeline. Public tracking links let you share progress with anyone without a login.",
  },
  {
    q: "Where do purchases and approvals fit in?",
    a: "When a job needs materials, requirements are logged and flagged for approval. Purchases beyond a set limit are passed to HOD, Principal or the admin team for sign-off before the job can close.",
  },
];

export default function FaqSection() {
  return (
    <section id="faq" className="mx-auto w-full max-w-page scroll-mt-24 px-[20px] py-12 sm:px-6">
      <h2 className="font-display text-2xl max-md:text-xl font-semibold text-ink">
        Frequently asked questions
      </h2>
      <div className="mt-6 space-y-3">
        {FAQS.map((f) => (
          <details key={f.q} className="card group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 text-sm font-medium text-graphite">
              {f.q}
              <span className="shrink-0 text-xs text-accent transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="px-4 pb-4 text-sm leading-relaxed text-slate">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}