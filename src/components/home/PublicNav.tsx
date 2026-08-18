import Link from "next/link";

/** Public (signed-out) navbar — logo left, section links center, Sign in + Get started right. */
export default function PublicNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-silver bg-white">
      <div className="mx-auto flex h-[70px] w-full max-w-page items-center justify-between gap-4 px-3 sm:px-4">
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-brand text-2xl max-md:text-xl leading-none tracking-wide text-ink font-bold! max-md:hidden">Servox</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/servoxlogo.png" alt="Servox" className="h-[34px] w-auto sm:h-[32px]" />
        </div>

        <nav className="hidden flex-1 items-center justify-center gap-[52px] text-sm font-medium text-slate lg:flex">
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

        <nav className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href="/signup" className="btn btn-brand btn-sm text-white! font-bold!">
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
