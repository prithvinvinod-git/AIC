"use client";

import { useMemo } from "react";
import { Paintbrush, Droplets } from "lucide-react";

const COLORS = ["#ff0000", "#ff9900", "#ffff00", "#00ff00", "#0099ff", "#9900ff", "#ff00ff"];

const DROP_DATA = COLORS.map((color, i) => ({
  color,
  left: 10 + i * 13,
  top: 10 + (i % 3) * 20,
  size: 30 + i * 5,
  dur: 2 + ((i * 7 + 3) % 30) / 10,
  delay: i * 0.4,
}));

const SPLASH_DATA = COLORS.map((color, i) => ({
  color,
  left: 10 + ((i * 29 + 11) % 80),
  top: 10 + ((i * 23 + 7) % 80),
  size: 60 + ((i * 17 + 13) % 80),
  dur: 3 + ((i * 11 + 5) % 20) / 10,
  delay: i * 0.5,
}));

export default function Holi() {
  const drops = useMemo(() => DROP_DATA, []);
  const splashes = useMemo(() => SPLASH_DATA, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#ff6b35] via-[#d63384] to-[#6f42c1]">
      <style>{`
        @keyframes splash { 0% { opacity: 0; transform: scale(0); } 50% { opacity: 0.8; } 100% { opacity: 0; transform: scale(2); } }
        @keyframes color-drop { 0% { opacity: 0; transform: translateY(-30px) scale(0.5); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(100px) scale(1.5); } }
        @keyframes rainbow-shift { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
        @keyframes pop-in { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
        .splash { animation: splash 2s ease-out infinite; position: absolute; border-radius: 50%; }
        .color-drop { animation: color-drop linear infinite; position: absolute; border-radius: 50%; }
        .rainbow-shift { animation: rainbow-shift 5s linear infinite; }
        .pop-in { animation: pop-in 0.8s ease-out forwards; }
        .pop-in-d1 { animation: pop-in 0.8s ease-out 0.3s forwards; opacity: 0; }
        .pop-in-d2 { animation: pop-in 0.8s ease-out 0.6s forwards; opacity: 0; }
      `}</style>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {drops.map((d, i) => (
          <div
            key={i}
            className="color-drop"
            style={{
              left: `${d.left}%`,
              top: `${d.top}%`,
              width: `${d.size}px`,
              height: `${d.size}px`,
              backgroundColor: d.color,
              animationDuration: `${d.dur}s`,
              animationDelay: `${d.delay}s`,
            }}
          />
        ))}
        {splashes.map((s, i) => (
          <div
            key={`s-${i}`}
            className="splash"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              backgroundColor: s.color,
              animationDuration: `${s.dur}s`,
              animationDelay: `${s.delay}s`,
              opacity: 0.3,
            }}
          />
        ))}
      </div>

      <div className="pop-in rainbow-shift mb-6">
        <Paintbrush className="h-16 w-16 sm:h-24 sm:w-24 text-white" strokeWidth={1.5} />
      </div>

      <pre className="pop-in text-[8px] sm:text-xs leading-tight text-white font-mono text-center mb-4">{`
  R A N G   B A R S E !
      `}</pre>

      <h1 className="pop-in text-3xl sm:text-5xl font-bold text-white text-center drop-shadow-lg">
        Happy Holi!
      </h1>
      <p className="pop-in-d1 mt-4 text-base sm:text-xl text-white/80 text-center max-w-md px-4">
        The festival of colors, love, and new beginnings. Let every splash bring joy and every hue paint happiness!
      </p>
      <p className="pop-in-d2 mt-6 flex items-center gap-1.5 text-sm text-white/60 font-mono">
        <Droplets className="h-3.5 w-3.5" aria-hidden /> Phagwah · Colors of Joy
      </p>
    </div>
  );
}
