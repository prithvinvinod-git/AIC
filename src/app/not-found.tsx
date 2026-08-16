import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <span className="tag border border-accent !bg-transparent text-accent!">404 · Page not found</span>

      <div>
        <p className="font-valve text-7xl leading-none tracking-tight text-accent sm:text-8xl">404</p>
        <h1 className="mt-4 font-display text-2xl max-md:text-xl font-semibold text-ink sm:text-3xl">
          This page got lost on campus.
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate">
          The page you&apos;re looking for doesn&apos;t exist or may have moved. Head back
          home or track an existing issue.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          Back to home
        </Link>
        <Link href="/track" className="btn btn-secondary">
          Track an issue
        </Link>
      </div>

      <div className="mt-6 flex items-center gap-2 font-brand text-lg leading-none text-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/servoxlogo.png" alt="Servox" className="h-[22px] w-auto" />
        <span className="tracking-wide">Servox</span>
      </div>
    </main>
  );
}
