"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import HeroAuthCard from "@/components/home/HeroAuthCard";
import { homeFor } from "@/lib/nav";
import type { SessionClaims } from "@/components/auth/AuthProvider";

export default function LoginPage() {
  const router = useRouter();

  const goHome = useCallback(
    (session: SessionClaims) => {
      router.replace(homeFor(session));
    },
    [router]
  );

  return <HeroAuthCard onSuccess={goHome} />;
}
