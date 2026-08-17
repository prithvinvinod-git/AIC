"use client";

import { useMemo } from "react";
import { TreePine, Snowflake, Star } from "lucide-react";

const SNOW_DATA = Array.from({ length: 20 }).map((_, i) => ({
  left: ((i * 37 + 13) % 100),
  dur: 3 + ((i * 7 + 3) % 40) / 10,
  delay: ((i * 11 + 5) % 50) / 10,
}));

export default function Christmas() {
  const snow = useMemo(() => SNOW_DATA, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#1a3a1a] via-[#0d2818] to-[#1a0a0a]">
      <style>{`
        @keyframes snowfall { 0% { opacity: 0; transform: translateY(-10px) translateX(0); } 10% { opacity: 1; } 90% { opacity: 1; } 100% { opacity: 0; transform: translateY(100vh) translateX(20px); } }
        @keyframes tree-glow { 0%,100% { filter: drop-shadow(0 0 8px rgba(45,138,78,0.5)); } 50% { filter: drop-shadow(0 0 20px rgba(45,138,78,0.9)); } }
        @keyframes tree-appear { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .snow { animation: snowfall linear infinite; position: absolute; }
        .tree-glow { animation: tree-glow 2s ease-in-out infinite; }
        .tree-appear { animation: tree-appear 1s ease-out forwards; }
        .fade-in { animation: fade-in 1s ease-out forwards; }
        .fade-in-d1 { animation: fade-in 1s ease-out 0.4s forwards; opacity: 0; }
        .fade-in-d2 { animation: fade-in 1s ease-out 0.8s forwards; opacity: 0; }
      `}</style>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {snow.map((s, i) => (
          <div
            key={i}
            className="snow"
            style={{
              left: `${s.left}%`,
              animationDuration: `${s.dur}s`,
              animationDelay: `${s.delay}s`,
            }}
          >
            <Snowflake className="h-3.5 w-3.5 text-white/60" />
          </div>
        ))}
      </div>

      <div className="tree-glow mb-4">
        <TreePine className="h-20 w-20 sm:h-28 sm:w-28 text-[#2d8a4e]" strokeWidth={1.5} />
      </div>

      <div className="tree-appear">
        <pre className="text-[8px] sm:text-xs leading-tight text-[#2d8a4e] font-mono text-center">{`
        *
       / \\
      /   \\
     /     \\
    /       \\
   /_________\\
       ║║║
       ╚══╝
        `}</pre>
      </div>

      <h1 className="fade-in text-3xl sm:text-5xl font-bold text-[#c41e3a] text-center drop-shadow-lg mt-4">
        Merry Christmas!
      </h1>
      <p className="fade-in-d1 mt-4 text-base sm:text-xl text-white/70 text-center max-w-md px-4">
        Wishing you warmth, joy, and togetherness this holiday season. May your days be merry and bright!
      </p>
      <p className="fade-in-d2 mt-6 flex items-center gap-1.5 text-sm text-[#c41e3a]/60 font-mono">
        <Star className="h-3.5 w-3.5" aria-hidden /> December 25 · Peace & Joy
      </p>
    </div>
  );
}
