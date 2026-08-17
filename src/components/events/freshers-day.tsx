"use client";

import { useMemo } from "react";
import { GraduationCap, PartyPopper, Sparkles, Star, Hand } from "lucide-react";

const CONFETTI_ICONS = [
  { Icon: PartyPopper, color: "text-amber-400" },
  { Icon: Sparkles, color: "text-pink-400" },
  { Icon: Star, color: "text-yellow-300" },
  { Icon: PartyPopper, color: "text-emerald-400" },
  { Icon: Sparkles, color: "text-sky-400" },
  { Icon: GraduationCap, color: "text-purple-400" },
];

const CONFETTI_DATA = CONFETTI_ICONS.map((item, i) => ({
  ...item,
  left: 8 + i * 15,
  dur: 3 + ((i * 7 + 3) % 30) / 10,
  delay: ((i * 11 + 5) % 40) / 10,
}));

export default function FreshersDay() {
  const confetti = useMemo(() => CONFETTI_DATA, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#1a237e] via-[#283593] to-[#3949ab]">
      <style>{`
        @keyframes confetti { 0% { opacity: 1; transform: translateY(-10px) rotate(0deg); } 100% { opacity: 0; transform: translateY(100vh) rotate(720deg); } }
        @keyframes cap-toss { 0% { transform: translateY(0) rotate(0deg); } 30% { transform: translateY(-40px) rotate(-15deg); } 60% { transform: translateY(-20px) rotate(10deg); } 100% { transform: translateY(0) rotate(0deg); } }
        @keyframes wave { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(20deg); } }
        @keyframes pop { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
        .confetti-piece { animation: confetti linear infinite; position: absolute; }
        .cap-toss { animation: cap-toss 2s ease-in-out infinite; }
        .wave { animation: wave 1s ease-in-out infinite; display: inline-block; }
        .pop { animation: pop 0.6s ease-out forwards; }
        .pop-d1 { animation: pop 0.6s ease-out 0.2s forwards; opacity: 0; }
        .pop-d2 { animation: pop 0.6s ease-out 0.4s forwards; opacity: 0; }
        .pop-d3 { animation: pop 0.6s ease-out 0.6s forwards; opacity: 0; }
      `}</style>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {confetti.map((c, i) => (
          <div
            key={i}
            className="confetti-piece"
            style={{
              left: `${c.left}%`,
              animationDuration: `${c.dur}s`,
              animationDelay: `${c.delay}s`,
            }}
          >
            <c.Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${c.color}`} />
          </div>
        ))}
      </div>

      <div className="cap-toss mb-4">
        <GraduationCap className="h-16 w-16 sm:h-24 sm:w-24 text-white" strokeWidth={1.5} />
      </div>

      <div className="pop text-center mb-4">
        <div className="wave">
          <Hand className="h-8 w-8 sm:h-10 sm:w-10 text-yellow-300" strokeWidth={1.5} />
        </div>
      </div>

      <pre className="pop-d1 text-[8px] sm:text-xs leading-tight text-[#c5cae9] font-mono text-center mb-4">{`
  ╔══════════════════════╗
  ║  WELCOME TO CAMPUS!  ║
  ║                      ║
  ║  New friends await.  ║
  ║  New dreams begin.   ║
  ╚══════════════════════╝
      `}</pre>

      <h1 className="pop-d1 text-3xl sm:text-5xl font-bold text-white text-center drop-shadow-lg">
        Welcome, Freshers!
      </h1>
      <p className="pop-d2 mt-4 text-base sm:text-xl text-white/70 text-center max-w-md px-4">
        A new chapter begins! Wishing you an amazing journey of learning, friendship, and discovery.
      </p>
      <p className="pop-d3 mt-6 flex items-center gap-1.5 text-sm text-white/50 font-mono">
        <Star className="h-3.5 w-3.5" aria-hidden /> Your adventure starts now
      </p>
    </div>
  );
}
