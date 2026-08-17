"use client";

import { Flag } from "lucide-react";

export default function RepublicDay() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#FF9933] via-white to-[#138808]">
      <style>{`
        @keyframes chakra-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes flag-wave { 0%,100% { transform: skewX(0deg); } 50% { transform: skewX(2deg); } }
        @keyframes float-up { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
        .chakra-spin { animation: chakra-spin 8s linear infinite; }
        .flag-wave { animation: flag-wave 3s ease-in-out infinite; }
        .float-up { animation: float-up 1s ease-out forwards; }
        .float-up-delay { animation: float-up 1s ease-out 0.3s forwards; opacity: 0; }
        .float-up-delay2 { animation: float-up 1s ease-out 0.6s forwards; opacity: 0; }
      `}</style>

      <div className="flag-wave text-center">
        <pre className="text-[8px] sm:text-xs leading-tight text-ink/80 font-mono">{`
  ┌──────────────────────────────┐
  │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
  │░░░░░░░░░ Saffron ░░░░░░░░░░░│
  │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
  ├──────────────────────────────┤
  │                              │
  │           ┌───┐              │
  │         ╱│   │╲             │
  │        │ │ ◎ │ │            │
  │         ╲│   │╱             │
  │           └───┘              │
  │                              │
  ├──────────────────────────────┤
  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
  │▓▓▓▓▓▓▓▓▓ Green ▓▓▓▓▓▓▓▓▓▓▓▓│
  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
  └──────────────────────────────┘
        `}</pre>
      </div>

      <div className="chakra-spin my-6">
        <Flag className="h-12 w-12 sm:h-16 sm:w-16 text-ink/80" strokeWidth={1.5} />
      </div>

      <h1 className="float-up text-3xl sm:text-5xl font-bold text-ink drop-shadow-lg text-center">
        Happy Republic Day!
      </h1>
      <p className="float-up-delay mt-4 text-base sm:text-xl text-ink/70 text-center max-w-md px-4">
        Celebrating the spirit of our constitution and the enduring democracy that binds us together.
      </p>
      <p className="float-up-delay2 mt-6 text-sm text-ink/50 font-mono">
        26 January · Jai Hind
      </p>
    </div>
  );
}
