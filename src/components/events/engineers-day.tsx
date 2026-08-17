"use client";

import { Wrench, Cog, CircuitBoard } from "lucide-react";

export default function EngineersDay() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#0d47a1] via-[#1565c0] to-[#1e88e5]">
      <style>{`
        @keyframes gear-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes gear-spin-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes circuit-pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
        @keyframes slide-in { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        .gear-spin { animation: gear-spin 4s linear infinite; }
        .gear-spin-reverse { animation: gear-spin-reverse 3s linear infinite; }
        .circuit-pulse { animation: circuit-pulse 2s ease-in-out infinite; }
        .slide-in { animation: slide-in 0.8s ease-out forwards; }
        .slide-in-d1 { animation: slide-in 0.8s ease-out 0.3s forwards; opacity: 0; }
        .slide-in-d2 { animation: slide-in 0.8s ease-out 0.6s forwards; opacity: 0; }
      `}</style>

      <div className="absolute inset-0 pointer-events-none">
        <div className="gear-spin absolute left-[10%] top-[15%] text-white/20"><Cog className="h-12 w-12 sm:h-14 sm:w-14" /></div>
        <div className="gear-spin-reverse absolute right-[15%] top-[20%] text-white/20"><Cog className="h-10 w-10 sm:h-12 sm:w-12" /></div>
        <div className="gear-spin absolute left-[20%] bottom-[20%] text-white/15"><Cog className="h-8 w-8" /></div>
        <div className="gear-spin-reverse absolute right-[10%] bottom-[25%] text-white/15"><Cog className="h-9 w-9 sm:h-10 sm:w-10" /></div>
      </div>

      <div className="circuit-pulse absolute inset-0 pointer-events-none">
        <div className="absolute left-[5%] top-[40%]"><CircuitBoard className="h-10 w-10 text-[#64b5f6] opacity-30" /></div>
        <div className="absolute right-[5%] top-[50%]"><CircuitBoard className="h-10 w-10 text-[#64b5f6] opacity-30" /></div>
      </div>

      <div className="slide-in mb-6">
        <Wrench className="h-16 w-16 sm:h-20 sm:w-20 text-white" strokeWidth={1.5} />
      </div>

      <pre className="slide-in text-[8px] sm:text-xs leading-tight text-[#bbdefb] font-mono text-center mb-4">{`
  ┌────────────────────┐
  │  ENGINEERING =     │
  │  Art + Science     │
  │  + Imagination     │
  └────────────────────┘
  ┌──┐  ┌──┐  ┌──┐
  │  ├──┤  ├──┤  │
  └──┘  └──┘  └──┘
      `}</pre>

      <h1 className="slide-in text-3xl sm:text-5xl font-bold text-white text-center drop-shadow-lg">
        Happy Engineers Day!
      </h1>
      <p className="slide-in-d1 mt-4 text-base sm:text-xl text-white/70 text-center max-w-md px-4">
        Celebrating the builders, innovators, and problem-solvers who shape our world with ideas and code.
      </p>
      <p className="slide-in-d2 mt-6 flex items-center gap-1.5 text-sm text-white/50 font-mono">
        <Cog className="h-3.5 w-3.5" aria-hidden /> September 15 · Build & Innovate
      </p>
    </div>
  );
}
