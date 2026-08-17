"use client";

import { useMemo } from "react";
import { Bot, Code2 } from "lucide-react";

const MATRIX_DATA = Array.from({ length: 12 }).map((_, i) => ({
  left: 5 + i * 8,
  dur: 4 + ((i * 7 + 3) % 40) / 10,
  delay: ((i * 11 + 5) % 30) / 10,
  chars: Array.from({ length: 20 }).map((_, j) => String.fromCharCode(0x30a0 + ((i * 13 + j * 7 + 11) % 96))).join(" "),
}));

export default function TechFest() {
  const matrix = useMemo(() => MATRIX_DATA, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#0a0a0a] via-[#0d1117] to-[#161b22]">
      <style>{`
        @keyframes matrix-rain { 0% { transform: translateY(-100%); opacity: 1; } 100% { transform: translateY(100vh); opacity: 0; } }
        @keyframes glow-text { 0%,100% { filter: drop-shadow(0 0 8px rgba(0,255,65,0.5)); } 50% { filter: drop-shadow(0 0 20px rgba(0,255,65,0.9)); } }
        @keyframes blink { 0%,100% { border-color: transparent; } 50% { border-color: #00ff41; } }
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .matrix-col { animation: matrix-rain linear infinite; position: absolute; font-family: monospace; color: #00ff41; opacity: 0.15; }
        .glow-text { animation: glow-text 2s ease-in-out infinite; }
        .type-cursor { border-right: 2px solid #00ff41; animation: blink 1s step-end infinite; }
        .fade-in { animation: fade-in 0.8s ease-out forwards; }
        .fade-in-d1 { animation: fade-in 0.8s ease-out 0.3s forwards; opacity: 0; }
        .fade-in-d2 { animation: fade-in 0.8s ease-out 0.6s forwards; opacity: 0; }
      `}</style>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {matrix.map((m, i) => (
          <div
            key={i}
            className="matrix-col text-[10px] sm:text-xs"
            style={{
              left: `${m.left}%`,
              animationDuration: `${m.dur}s`,
              animationDelay: `${m.delay}s`,
              writingMode: "vertical-rl",
            }}
          >
            {m.chars}
          </div>
        ))}
      </div>

      <div className="fade-in glow-text mb-6">
        <Bot className="h-16 w-16 sm:h-24 sm:w-24 text-[#00ff41]" strokeWidth={1.5} />
      </div>

      <pre className="fade-in text-[7px] sm:text-[10px] leading-tight text-[#00ff41] font-mono text-center mb-4">{`
  ┌─────────────────────────────┐
  │  $ echo "Hello Tech Fest"  │
  │  > Hello Tech Fest          │
  │                             │
  │  $ npm run innovation       │
  │  > Building the future...   │
  └─────────────────────────────┘
      `}</pre>

      <h1 className="fade-in glow-text text-3xl sm:text-5xl font-bold text-[#00ff41] text-center">
        Tech Fest!
      </h1>
      <p className="fade-in-d1 mt-4 text-base sm:text-xl text-white/50 text-center max-w-md px-4">
        Where code meets creativity and ideas take flight. Innovation, collaboration, and the future starts here.
      </p>
      <p className="fade-in-d2 mt-6 flex items-center gap-1.5 text-sm text-[#00ff41]/50 font-mono type-cursor">
        <Code2 className="h-3.5 w-3.5" aria-hidden /> {"// HACK · BUILD · INNOVATE"}
      </p>
    </div>
  );
}
