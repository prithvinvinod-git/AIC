"use client";

import { useMemo } from "react";
import { Egg, Flower2, Sparkles } from "lucide-react";

const SPARKLE_DATA = Array.from({ length: 5 }).map((_, i) => ({
  left: 10 + i * 20,
  top: 15 + (i % 3) * 25,
  delay: i * 0.5,
  size: "h-5 w-5 sm:h-6 sm:w-6",
}));

const EGG_COLORS = ["text-yellow-400", "text-pink-300", "text-sky-300", "text-green-400", "text-purple-400"];

const EGG_DATA = EGG_COLORS.map((color, i) => ({
  color,
  delay: 0.2 + i * 0.15,
}));

export default function Easter() {
  const sparkles = useMemo(() => SPARKLE_DATA, []);
  const eggs = useMemo(() => EGG_DATA, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#fce4ec] via-[#f3e5f5] to-[#e8eaf6]">
      <style>{`
        @keyframes egg-bounce { 0%,100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-15px) rotate(-5deg); } 75% { transform: translateY(-15px) rotate(5deg); } }
        @keyframes egg-appear { 0% { opacity: 0; transform: scale(0) rotate(-180deg); } 100% { opacity: 1; transform: scale(1) rotate(0deg); } }
        @keyframes sparkle { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
        @keyframes fade-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .egg-bounce { animation: egg-bounce 2s ease-in-out infinite; }
        .egg-appear { animation: egg-appear 0.6s ease-out forwards; }
        .sparkle-anim { animation: sparkle 1.5s ease-in-out infinite; position: absolute; }
        .fade-up { animation: fade-up 0.8s ease-out forwards; }
        .fade-up-d1 { animation: fade-up 0.8s ease-out 0.3s forwards; opacity: 0; }
        .fade-up-d2 { animation: fade-up 0.8s ease-out 0.6s forwards; opacity: 0; }
      `}</style>

      <div className="absolute inset-0 pointer-events-none">
        {sparkles.map((s, i) => (
          <div
            key={i}
            className="sparkle-anim"
            style={{ left: `${s.left}%`, top: `${s.top}%`, animationDelay: `${s.delay}s` }}
          >
            {i % 2 === 0 ? (
              <Flower2 className={`${s.size} text-pink-300`} />
            ) : (
              <Sparkles className={`${s.size} text-purple-300`} />
            )}
          </div>
        ))}
      </div>

      <div className="egg-bounce mb-6">
        <Egg className="h-16 w-16 sm:h-24 sm:w-24 text-[#7b1fa2]" strokeWidth={1.5} />
      </div>

      <div className="flex gap-3 mb-4">
        {eggs.map((e, i) => (
          <div
            key={i}
            className="egg-appear"
            style={{ animationDelay: `${e.delay}s`, opacity: 0 }}
          >
            <Egg className={`h-8 w-8 sm:h-10 sm:w-10 ${e.color}`} strokeWidth={1.5} />
          </div>
        ))}
      </div>

      <pre className="fade-up text-[8px] sm:text-xs leading-tight text-[#7b1fa2] font-mono text-center mb-4">{`
    /\\_/\\
   ( o.o )
    > ^ <
   /|   |\\
  (_|   |_)
    Easter Bunny
      `}</pre>

      <h1 className="fade-up text-3xl sm:text-5xl font-bold text-[#7b1fa2] text-center drop-shadow-lg">
        Happy Easter!
      </h1>
      <p className="fade-up-d1 mt-4 text-base sm:text-xl text-[#4a148c]/70 text-center max-w-md px-4">
        A celebration of renewal, hope, and new beginnings. May this season fill your life with warmth and joy!
      </p>
      <p className="fade-up-d2 mt-6 flex items-center gap-1.5 text-sm text-[#7b1fa2]/60 font-mono">
        <Flower2 className="h-3.5 w-3.5" aria-hidden /> Spring · Renewal & Hope
      </p>
    </div>
  );
}
