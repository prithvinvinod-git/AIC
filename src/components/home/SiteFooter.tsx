import Link from "next/link";

const PRODUCT_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Report an issue", href: "/new" },
  { label: "Track an issue", href: "/track" },
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

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "#privacy" },
  { label: "Terms of Service", href: "#terms" },
  { label: "Campus Governance", href: "#governance" },
  { label: "Security Audit", href: "#security" },
];

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <>
      <style>{`
        #servox-site-footer .footer-link {
          position: relative;
          transition: color 0.2s ease, transform 0.2s ease;
          display: inline-flex;
          align-items: center;
        }
        #servox-site-footer .footer-link:hover {
          color: #f5f5f4;
          transform: translateX(2px);
        }
        #servox-site-footer .footer-link::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 0%;
          height: 1px;
          background-color: #ea7a5d;
          transition: width 0.25s ease-out;
        }
        #servox-site-footer .footer-link:hover::after {
          width: 100%;
        }
      `}</style>
      <footer
        id="servox-site-footer"
        className="relative w-full overflow-hidden border-t border-white/[0.08] bg-[#141312] text-[#a8a29e]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/4 top-0 h-24 w-96 -translate-x-1/2 bg-[#ea7a5d]/5 blur-3xl"
        />
        <div className="mx-auto w-full max-w-page px-[20px] pt-16 pb-12 sm:px-6 lg:px-10">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="flex flex-col justify-between pr-0 lg:col-span-5 lg:pr-10">
              <div>
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/servoxlogo.png"
                    alt="Servox"
                    className="h-[26px] w-auto drop-shadow-[0_0_8px_rgba(234,122,93,0.25)]"
                  />
                  <span className="font-sans text-xl font-extrabold uppercase tracking-widest text-stone-100">
                    Servox
                  </span>
                </div>
                <p className="mt-5 max-w-md text-[14px] font-normal leading-relaxed text-[#a8a29e]">
                  A governed, AI-assisted workflow for professional campus maintenance — every
                  request is validated, prioritised, assigned and verified before closure.
                </p>
                <p className="mt-3 flex items-center gap-2 font-mono text-xs tracking-wide text-stone-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#ea7a5d]" />
                  Built for professional campus teams.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 pt-2 sm:grid-cols-3 sm:gap-6 lg:col-span-7 lg:pt-0">
              <div>
                <h3 className="mb-5 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-stone-100">
                  <span className="h-1 w-1 rounded-full bg-[#ea7a5d]" />
                  Product
                </h3>
                <ul className="space-y-3.5 text-sm">
                  {PRODUCT_LINKS.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="footer-link text-[#a8a29e]">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-5 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-stone-100">
                  <span className="h-1 w-1 rounded-full bg-[#ea7a5d]" />
                  Platform
                </h3>
                <ul className="space-y-3.5 text-sm">
                  {PLATFORM_LINKS.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="footer-link text-[#a8a29e]">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-5 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-stone-100">
                  <span className="h-1 w-1 rounded-full bg-[#ea7a5d]" />
                  About
                </h3>
                <ul className="space-y-3.5 text-sm">
                  {ABOUT_LINKS.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="footer-link text-[#a8a29e]">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                  <li className="border-t border-white/[0.06] pt-2">
                    <div className="mb-1 font-mono text-xs text-stone-400">Direct Campus Desk</div>
                    <a
                      href="mailto:servox@gmail.com"
                      className="group inline-flex items-center gap-1.5 font-medium text-[#ea7a5d] transition-colors hover:text-[#f09077]"
                    >
                      <svg
                        className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:scale-110"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <rect height="16" rx="2" width="20" x="2" y="4"></rect>
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                      </svg>
                      <span className="underline decoration-[#ea7a5d]/40 decoration-1 underline-offset-2">
                        servox@gmail.com
                      </span>
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.08]">
          <div className="mx-auto flex w-full max-w-page flex-col items-center justify-between gap-4 px-[20px] py-5 font-mono text-xs text-stone-400 sm:flex-row sm:px-6 lg:px-10">
            <p>
              © {year} servox-phi <span className="text-stone-600">•</span> All rights reserved.
            </p>
            <nav aria-label="Legal links" className="flex flex-wrap items-center gap-6 text-stone-400">
              {LEGAL_LINKS.map((l) => (
                <a key={l.label} href={l.href} className="transition-colors hover:text-stone-200">
                  {l.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </footer>
    </>
  );
}