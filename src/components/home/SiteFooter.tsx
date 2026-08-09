import Link from "next/link";

const PRODUCT_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Report an issue", href: "/new" },
  { label: "Track an issue", href: "/login" },
  { label: "Create an account", href: "/signup" },
];

const PLATFORM_LINKS = [
  { label: "Dashboard", href: "/" },
  { label: "Analytics", href: "/analytics" },
  { label: "Announcements", href: "/announcements" },
  { label: "Issue history", href: "/issue-history" },
  { label: "Notifications", href: "/notifications" },
];

const ABOUT_LINKS = [
  { label: "AI implementations", href: "#ai" },
  { label: "Role-based access", href: "#how-it-works" },
  { label: "SLA enforcement", href: "#how-it-works" },
  { label: "Verify before close", href: "#how-it-works" },
];

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer id="footer" className="scroll-mt-24 border-t border-silver bg-white">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2 font-brand text-lg leading-none text-ink">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/servoxlogo.png" alt="Servox" className="h-[22px] w-auto" />
              <span className="tracking-wide">Servox</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate">
              A governed, AI-assisted workflow for professional campus maintenance — every request
              is validated, prioritised, assigned and verified before closure.
            </p>
            <p className="mt-4 text-sm text-stone">
              Built for professional campus teams.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-graphite">
              Product
            </h3>
            <ul className="mt-4 space-y-2.5">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-slate transition-colors hover:text-action-blue">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-graphite">
              Platform
            </h3>
            <ul className="mt-4 space-y-2.5">
              {PLATFORM_LINKS.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-slate transition-colors hover:text-action-blue">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-graphite">
              About
            </h3>
            <ul className="mt-4 space-y-2.5">
              {ABOUT_LINKS.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-slate transition-colors hover:text-action-blue">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-slate">
              Support:{" "}
              <a href="mailto:support@servox-phi.example" className="link-blue font-medium">
                support@servox-phi.example
              </a>
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-silver">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center justify-between gap-3 px-4 py-5 text-sm text-slate sm:flex-row sm:px-6">
          <p>© {year} servox-phi · All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
