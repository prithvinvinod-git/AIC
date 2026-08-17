"use client";

import { useMemo } from "react";
import { Leaf, TreePine } from "lucide-react";

const LEAF_COLORS = ["text-green-400", "text-emerald-400", "text-lime-400", "text-green-500", "text-teal-400"];

const LEAF_DATA = LEAF_COLORS.map((color, i) => ({
  color,
  left: 10 + i * 18,
  dur: 5 + i,
  delay: i * 1.2,
}));

export default function EnvironmentDay() {
  const leaves = useMemo(() => LEAF_DATA, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#1b5e20] via-[#2e7d32] to-[#43a047]">
      <style>{`
        @keyframes leaf-fall { 0% { opacity: 0; transform: translateY(-20px) rotate(0deg) translateX(0); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(100vh) rotate(360deg) translateX(30px); } }
        @keyframes grow { 0% { transform: scaleY(0); transform-origin: bottom; } 100% { transform: scaleY(1); transform-origin: bottom; } }
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .leaf-icon { animation: leaf-fall linear infinite; position: absolute; }
        .grow { animation: grow 1.5s ease-out forwards; }
        .fade-in { animation: fade-in 0.8s ease-out forwards; }
        .fade-in-d1 { animation: fade-in 0.8s ease-out 0.3s forwards; opacity: 0; }
        .fade-in-d2 { animation: fade-in 0.8s ease-out 0.6s forwards; opacity: 0; }
      `}</style>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {leaves.map((l, i) => (
          <div
            key={i}
            className={`leaf-icon ${l.color}`}
            style={{
              left: `${l.left}%`,
              animationDuration: `${l.dur}s`,
              animationDelay: `${l.delay}s`,
            }}
          >
            <Leaf className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        ))}
      </div>

      <div className="fade-in mb-6">
        <Leaf className="h-16 w-16 sm:h-24 sm:w-24 text-[#c8e6c9]" strokeWidth={1.5} />
      </div>

      <div className="grow">
        <pre className="text-[8px] sm:text-xs leading-tight text-[#c8e6c9] font-mono text-center">{`
       🌳
      ╱  ╲
     ╱    ╲
    ╱      ╲
   ╱________╲
       ║║
       ║║
    ═══╩╩═══
      `}</pre>
      </div>

      <h1 className="fade-in text-3xl sm:text-5xl font-bold text-white text-center drop-shadow-lg mt-4">
        Happy Environment Day!
      </h1>
      <p className="fade-in-d1 mt-4 text-base sm:text-xl text-white/70 text-center max-w-md px-4">
        Reflecting on our planet and our duty to protect it. Every small action counts towards a greener tomorrow.
      </p>
      <p className="fade-in-d2 mt-6 flex items-center gap-1.5 text-sm text-white/50 font-mono">
        <TreePine className="h-3.5 w-3.5" aria-hidden /> June 5 · Go Green
      </p>
    </div>
  );
}
