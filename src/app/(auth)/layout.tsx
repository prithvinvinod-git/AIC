import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2 font-brand text-lg leading-none text-ink sm:text-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="tracking-wide">Servox</span>
          <img src="/servoxlogo.png" alt="Servox" className="h-[20px] w-auto sm:h-[24px]" />
        </Link>
        <Link
          href="/"
          className="link-blue flex items-center gap-1.5 rounded-full border border-silver bg-white px-3 py-1.5 text-sm font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to home
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-[420px]">{children}</div>
      </main>
    </div>
  );
}
