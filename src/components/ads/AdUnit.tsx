"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

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
}

export default function AdUnit({ slot, className }: AdUnitProps) {
  const ref = useRef<HTMLModElement | null>(null);

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
    const immediate = render();
    const retry = window.setTimeout(render, 1500);
    return () => {
      cleared = true;
      window.clearTimeout(retry);
    };
  }, [slot]);

  return (
    <ins
      ref={ref}
      className={cn("adsbygoogle block", className)}
      style={{ display: "block", minHeight: 90 }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}