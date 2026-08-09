import Link from "next/link";

/** Public (signed-out) navbar — logo left, section links center, Sign in + Get started right. */
export default function PublicNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-silver bg-white">
      <div className="mx-auto flex h-[70px] w-full max-w-[1200px] items-center justify-between px-2 sm:px-3">
        <div className="flex items-center gap-2 -ml-30">
          <span className="font-valve text-2xl leading-none tracking-wide text-ink">Servox</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/servoxlogo.png" alt="Servox" className="h-[34px] w-auto sm:h-[38px]" />
        </div>

        <nav className="ml-[800px] hidden items-center gap-[52px] text-sm font-medium text-slate md:flex">
          <a href="#how-it-works" className="transition-colors hover:text-ink">
            How it works
          </a>
          <a href="#ai" className="transition-colors hover:text-ink">
            AI
          </a>
          <a href="#footer" className="transition-colors hover:text-ink">
            Contact
          </a>
        </nav>

        <nav className="flex items-center gap-3 mr-[-100px]">
          <Link href="/login" className="btn btn-primary btn-sm">
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-brand btn-sm">
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
