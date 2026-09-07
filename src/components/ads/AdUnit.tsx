"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Megaphone } from "lucide-react";

const ADSENSE_CLIENT = "ca-pub-6865869538408644";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

let injected = false;

function injectAdsense() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const script = document.createElement("script");
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  script.async = true;
  script.crossOrigin = "anonymous";
  document.head.append(script);
}

interface AdUnitProps {
  slot: string;
  className?: string;
  variant?: "light" | "dark";
}

export default function AdUnit({ slot, className, variant = "light" }: AdUnitProps) {
  const ref = useRef<HTMLModElement | null>(null);
  const [unfilled, setUnfilled] = useState(false);

  useEffect(() => {
    injectAdsense();
    let cleared = false;
    const render = () => {
      if (cleared || !ref.current || typeof window === "undefined" || !window.adsbygoogle) return;
      try {
        window.adsbygoogle.push({});
      } catch {
        /* ad network rejected the push; ignore */
      }
    };
    render();
    const retry = window.setTimeout(render, 1500);

    const checks = [
      window.setTimeout(() => {
        if (!cleared && ref.current?.dataset.adStatus === "unfilled") setUnfilled(true);
      }, 2500),
      window.setTimeout(() => {
        if (!cleared && ref.current?.dataset.adStatus === "unfilled") setUnfilled(true);
      }, 6000),
      window.setTimeout(() => {
        if (!cleared && ref.current && !ref.current.dataset.adStatus) setUnfilled(true);
      }, 12000),
    ];

    return () => {
      cleared = true;
      window.clearTimeout(retry);
      checks.forEach(window.clearTimeout);
    };
  }, [slot]);

  return (
    <div
      className={cn(
        variant === "dark" &&
          "mx-auto w-full rounded-xl border border-white/[0.08] bg-[#141312] p-3"
      )}
    >
      {unfilled ? (
        <div
          role="complementary"
          aria-label="Advertisement"
          className="flex min-h-[100px] w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.02] px-4 py-6 text-center"
        >
          <Megaphone className="h-5 w-5 text-white/20" aria-hidden />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-white/30">
            Advertisement
          </span>
        </div>
      ) : (
        <ins
          ref={ref}
          className={cn("adsbygoogle block", className)}
          style={{ display: "block", minHeight: 90 }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      )}
    </div>
  );
}