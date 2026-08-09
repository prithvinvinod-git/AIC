"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HeroAuthCard from "@/components/home/HeroAuthCard";
import { homeFor } from "@/lib/nav";
import type { SessionClaims } from "@/components/auth/AuthProvider";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goHome = useCallback(
    (session: SessionClaims) => {
      const next = searchParams.get("next");
      if (next && next.startsWith("/") && !next.startsWith("//")) {
        router.replace(next);
        return;
      }
      router.replace(homeFor(session));
    },
    [router, searchParams]
  );

  return <HeroAuthCard onSuccess={goHome} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
