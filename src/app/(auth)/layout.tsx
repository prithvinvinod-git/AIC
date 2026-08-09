"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  const pathname = usePathname();
  const showBrand = pathname !== "/signup";

  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-6 py-6">
        {showBrand ? (
          <Link href="/" className="flex items-center gap-2 font-brand text-lg leading-none text-ink sm:text-xl">
            <span className="tracking-wide">Servox</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/servoxlogo.png" alt="Servox" className="h-[20px] w-auto sm:h-[24px]" />
          </Link>
        ) : (
          <span />
        )}
        <Link
          href="/"
          className="link-blue flex items-center gap-1.5 rounded-full border border-silver bg-white px-3 py-1.5 text-sm font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to home
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-[460px]">{children}</div>
      </main>
    </div>
  );
}
