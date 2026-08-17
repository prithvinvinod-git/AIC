"use client";

import { useMemo } from "react";
import { Moon, Star } from "lucide-react";

const STAR_DATA = Array.from({ length: 15 }).map((_, i) => ({
  left: 10 + ((i * 23 + 7) % 80),
  top: 5 + ((i * 17 + 3) % 40),
  size: 8 + ((i * 11 + 5) % 12),
  dur: 1.5 + ((i * 13 + 7) % 20) / 10,
  delay: ((i * 19 + 11) % 30) / 10,
}));

export default function Eid() {
  const stars = useMemo(() => STAR_DATA, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#0a3d2a] via-[#0d5c3a] to-[#1a6b4a]">
      <style>{`
        @keyframes star-twinkle { 0%,100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
        @keyframes moon-glow { 0%,100% { filter: drop-shadow(0 0 12px rgba(212,175,55,0.5)); } 50% { filter: drop-shadow(0 0 30px rgba(212,175,55,0.9)); } }
        @keyframes float-in { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .star-icon { animation: star-twinkle ease-in-out infinite; position: absolute; }
        .moon-glow { animation: moon-glow 3s ease-in-out infinite; }
        .float-in { animation: float-in 1s ease-out forwards; }
        .float-in-d1 { animation: float-in 1s ease-out 0.3s forwards; opacity: 0; }
        .float-in-d2 { animation: float-in 1s ease-out 0.6s forwards; opacity: 0; }
      `}</style>

      <div className="absolute inset-0 pointer-events-none">
        {stars.map((s, i) => (
          <div
            key={i}
            className="star-icon"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              animationDuration: `${s.dur}s`,
              animationDelay: `${s.delay}s`,
            }}
          >
            <Star className="text-yellow-300" style={{ width: `${s.size}px`, height: `${s.size}px` }} />
          </div>
        ))}
      </div>

      <div className="moon-glow mb-6">
        <Moon className="h-16 w-16 sm:h-24 sm:w-24 text-[#d4af37]" strokeWidth={1.5} />
      </div>

      <div className="float-in">
        <pre className="text-[8px] sm:text-xs leading-tight text-[#d4af37] font-mono text-center">{`
      ┌───────────┐
      │  ┌───┐    │
      │  │ ◉ │    │
      │  └───┘    │
      │           │
      │  ╔═══╗    │
      │  ║   ║    │
      │  ╚═══╝    │
      │ ╱│   │╲   │
      └───────────┘
      Mosque silhouette
        `}</pre>
      </div>

      <h1 className="float-in text-3xl sm:text-5xl font-bold text-[#d4af37] text-center drop-shadow-lg mt-4">
        Eid Mubarak!
      </h1>
      <p className="float-in-d1 mt-4 text-base sm:text-xl text-white/70 text-center max-w-md px-4">
        Celebrating faith, community, and gratitude. May this blessed occasion bring peace and happiness to all.
      </p>
      <p className="float-in-d2 mt-6 flex items-center gap-1.5 text-sm text-[#d4af37]/60 font-mono">
        <Moon className="h-3.5 w-3.5" aria-hidden /> Eid ul-Fitr · Blessings & Joy
      </p>
    </div>
  );
}
