"use client";

import { useMemo, useRef, useEffect, useCallback } from "react";
import { Sparkles } from "lucide-react";

const CONFETTI_COLORS = ["#FF9933", "#FFFFFF", "#138808", "#FFD700", "#FF9933", "#FFFFFF"];
const CONFETTI_COUNT = 40;
const SPARK_COUNT = 25;
const FW_COUNT = 8;

function seededRand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export default function IndependenceDay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const confetti = useMemo(() =>
    Array.from({ length: CONFETTI_COUNT }).map((_, i) => ({
      x: seededRand(i * 3 + 1) * 100,
      delay: seededRand(i * 3 + 2) * 8,
      dur: 4 + seededRand(i * 3 + 3) * 6,
      size: 4 + seededRand(i * 7) * 8,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotation: seededRand(i * 11) * 360,
      wobble: seededRand(i * 13) * 20 - 10,
    })), []);

  const sparks = useMemo(() =>
    Array.from({ length: SPARK_COUNT }).map((_, i) => ({
      x: seededRand(i * 5 + 100) * 100,
      y: seededRand(i * 5 + 101) * 100,
      delay: seededRand(i * 5 + 102) * 5,
      dur: 1.5 + seededRand(i * 5 + 103) * 2,
      size: 2 + seededRand(i * 5 + 104) * 3,
    })), []);

  const fireworks = useMemo(() =>
    Array.from({ length: FW_COUNT }).map((_, i) => ({
      x: 10 + seededRand(i * 4 + 200) * 80,
      y: 5 + seededRand(i * 4 + 201) * 35,
      delay: seededRand(i * 4 + 202) * 4,
      dur: 2 + seededRand(i * 4 + 203) * 2,
      color: CONFETTI_COLORS[i % 3],
      size: 60 + seededRand(i * 4 + 204) * 80,
    })), []);

  const drawFireworks = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }
    };
    resize();

    const particles: { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }[] = [];

    const colors = ["#FF9933", "#FFD700", "#138808", "#FFFFFF", "#FF9933"];
    const fwPositions = Array.from({ length: 6 }).map((_, i) => ({
      x: 0.1 + seededRand(i * 7 + 300) * 0.8,
      y: 0.1 + seededRand(i * 7 + 301) * 0.35,
    }));

    function spawnBurst(cx: number, cy: number, color: string, count: number) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (seededRand(i * 17 + Date.now()) - 0.5) * 0.3;
        const speed = 0.5 + seededRand(i * 23 + Date.now()) * 2;
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color,
          size: 1 + Math.random() * 2,
        });
      }
    }

    let frameCount = 0;
    function frame() {
      frameCount++;
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      // Periodic bursts
      if (frameCount % 60 === 0 || (frameCount > 10 && frameCount % 40 === 0)) {
        const fwIdx = Math.floor(seededRand(frameCount) * fwPositions.length);
        const fw = fwPositions[fwIdx];
        const colorIdx = Math.floor(seededRand(frameCount + 999) * colors.length);
        spawnBurst(fw.x * canvas!.width, fw.y * canvas!.height, colors[colorIdx], 30 + Math.floor(seededRand(frameCount + 1999) * 20));
      }

      // Update & draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02; // gravity
        p.life -= 0.012;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx!.globalAlpha = p.life * 0.8;
        ctx!.fillStyle = p.color;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(frame);
    }
    frame();
  }, []);

  useEffect(() => {
    drawFireworks();
    return () => cancelAnimationFrame(rafRef.current);
  }, [drawFireworks]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#02040a]">
      <style>{`
        @keyframes confetti-fall {
          0% { opacity: 0; transform: translateY(-5vh) rotate(0deg) translateX(0); }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { opacity: 0; transform: translateY(105vh) rotate(720deg) translateX(30px); }
        }
        @keyframes spark-twinkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes fw-ring {
          0% { opacity: 0; transform: scale(0); }
          30% { opacity: 1; }
          100% { opacity: 0; transform: scale(1); }
        }
        @keyframes chakra-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes flag-wave {
          0%, 100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
          25% { clip-path: polygon(0 0, 98% 2%, 100% 98%, 0 100%); }
          50% { clip-path: polygon(0 2%, 100% 0, 100% 100%, 0 98%); }
          75% { clip-path: polygon(0 0, 100% 2%, 98% 100%, 0 100%); }
        }
        @keyframes glow-pulse {
          0%, 100% { text-shadow: 0 0 20px rgba(255,153,51,0.5), 0 0 40px rgba(255,153,51,0.3), 0 0 80px rgba(255,153,51,0.1); }
          50% { text-shadow: 0 0 30px rgba(255,153,51,0.8), 0 0 60px rgba(255,153,51,0.5), 0 0 120px rgba(255,153,51,0.3); }
        }
        @keyframes float-up {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes flag-undulate {
          0% { transform: skewY(0deg) scaleY(1); }
          25% { transform: skewY(0.5deg) scaleY(0.99); }
          50% { transform: skewY(-0.5deg) scaleY(1.01); }
          75% { transform: skewY(0.3deg) scaleY(0.995); }
          100% { transform: skewY(0deg) scaleY(1); }
        }
        @keyframes pop-in {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        .glow-saffron { animation: glow-pulse 3s ease-in-out infinite; }
        .float-up { animation: float-up 1s ease-out forwards; }
        .float-up-d1 { animation: float-up 1s ease-out 0.3s forwards; opacity: 0; }
        .float-up-d2 { animation: float-up 1s ease-out 0.6s forwards; opacity: 0; }
        .float-up-d3 { animation: float-up 1s ease-out 0.9s forwards; opacity: 0; }
      `}</style>

      {/* Background canvas for firework particles */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0 h-full w-full"
        style={{ pointerEvents: "none" }}
      />

      {/* Gradient overlays for depth */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-transparent via-[#02040a]/30 to-[#02040a]/80" />
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,rgba(255,153,51,0.05)_0%,transparent_70%)]" />

      {/* CSS fireworks rings */}
      <div className="absolute inset-0 z-[2] pointer-events-none">
        {fireworks.map((fw, i) => (
          <div
            key={`fw-${i}`}
            className="absolute rounded-full border-2"
            style={{
              left: `${fw.x}%`,
              top: `${fw.y}%`,
              width: `${fw.size}px`,
              height: `${fw.size}px`,
              borderColor: fw.color,
              animation: `fw-ring ${fw.dur}s ease-out ${fw.delay}s infinite`,
              boxShadow: `0 0 20px ${fw.color}40, inset 0 0 20px ${fw.color}20`,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
      </div>

      {/* CSS spark particles */}
      <div className="absolute inset-0 z-[2] pointer-events-none">
        {sparks.map((s, i) => (
          <div
            key={`sp-${i}`}
            className="absolute rounded-full bg-[#FFD700]"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              boxShadow: "0 0 6px #FFD700, 0 0 12px #FF993360",
              animation: `spark-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Falling confetti */}
      <div className="absolute inset-0 z-[3] pointer-events-none overflow-hidden">
        {confetti.map((c, i) => (
          <div
            key={`cf-${i}`}
            className="absolute"
            style={{
              left: `${c.x}%`,
              width: `${c.size}px`,
              height: `${c.size * 0.6}px`,
              backgroundColor: c.color,
              borderRadius: c.size > 7 ? "50%" : "1px",
              animation: `confetti-fall ${c.dur}s linear ${c.delay}s infinite`,
              transform: `rotate(${c.rotation}deg)`,
              boxShadow: `0 0 3px ${c.color}60`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6">
        {/* 15 August label */}
        <p className="float-up mb-6 text-xs sm:text-sm font-semibold tracking-[0.3em] text-[#72de5c] uppercase"
          style={{ fontFamily: "var(--font-valve), monospace" }}>
          15 August
        </p>

        {/* Flag */}
        <div className="float-up-d1 mb-8" style={{ animation: "flag-undulate 4s ease-in-out infinite" }}>
          <div className="relative overflow-hidden rounded-sm shadow-[0_0_40px_rgba(255,153,51,0.3)]" style={{ width: "180px", height: "120px" }}>
            {/* Saffron */}
            <div className="absolute inset-x-0 top-0 h-[33.33%] bg-[#FF9933]" />
            {/* White */}
            <div className="absolute inset-x-0 top-[33.33%] h-[33.33%] bg-white" />
            {/* Green */}
            <div className="absolute inset-x-0 top-[66.66%] h-[33.34%] bg-[#138808]" />
            {/* Ashoka Chakra */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="relative h-[36px] w-[36px] rounded-full border-[2.5px] border-[#000080] flex items-center justify-center"
                style={{ animation: "chakra-spin 10s linear infinite" }}>
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute h-[1px] w-[14px] bg-[#000080]"
                    style={{ transform: `rotate(${i * 15}deg)`, transformOrigin: "center" }}
                  />
                ))}
                <div className="h-[4px] w-[4px] rounded-full bg-[#000080]" />
              </div>
            </div>
            {/* Flag pole shadow */}
            <div className="absolute -left-1 top-0 h-full w-[3px] bg-gradient-to-b from-[#8B7355] via-[#A0926B] to-[#8B7355] rounded-full" />
          </div>
          {/* Flag pole */}
          <div className="absolute -left-2 top-0 h-[130px] w-[4px] rounded-full bg-gradient-to-b from-[#D4AF37] via-[#C5A028] to-[#8B7355]"
            style={{ boxShadow: "1px 0 4px rgba(0,0,0,0.3)" }} />
        </div>

        {/* Main headline */}
        <h1 className="float-up-d2 glow-saffron text-3xl sm:text-5xl md:text-6xl font-black text-white leading-tight max-w-xl"
          style={{ fontFamily: "var(--font-brand), sans-serif" }}>
          Happy Independence Day!
        </h1>

        {/* Description */}
        <p className="float-up-d3 mt-4 text-sm sm:text-base text-white/60 max-w-md leading-relaxed">
          Honoring the courage of those who fought for our freedom, and the resilience that defines our nation.
        </p>

        {/* Ashoka Chakra decorative divider */}
        <div className="float-up-d3 mt-8 mb-6 flex items-center gap-3">
          <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-[#FF9933]/50" />
          <div className="relative h-8 w-8 rounded-full border border-[#FF9933]/30 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-[#FF9933]/60" style={{ animation: "chakra-spin 6s linear infinite" }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="absolute left-1/2 top-1/2 h-[0.5px] w-[8px] -translate-x-1/2 -translate-y-1/2 bg-[#FF9933]/40"
                  style={{ transform: `rotate(${i * 22.5}deg)` }} />
              ))}
            </div>
          </div>
          <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-[#FF9933]/50" />
        </div>

        {/* Jai Hind */}
        <div className="float-up-d3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#FFD700]" />
          <p className="text-xl sm:text-3xl font-bold text-[#FFD700]"
            style={{
              fontFamily: "var(--font-valve), sans-serif",
              textShadow: "0 0 20px rgba(255,215,0,0.5), 0 0 40px rgba(255,215,0,0.3)",
            }}>
            Jai Hind
          </p>
          <Sparkles className="h-4 w-4 text-[#FFD700]" />
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 inset-x-0 h-32 z-[4] bg-gradient-to-t from-[#02040a] to-transparent pointer-events-none" />
    </div>
  );
}
