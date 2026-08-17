"use client";

import { useRef, useEffect } from "react";
import { Sparkles } from "lucide-react";

export default function Onam() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let mouseX = width / 2;

    const colors = ["#d4af37", "#e9c349", "#fefccf", "#ff9b3f"];
    let particles: { x: number; y: number; size: number; speedY: number; speedX: number; angle: number; spin: number; opacity: number; color: string; depth: number; driftAmp: number; driftSpeed: number }[] = [];

    function resize() {
      width = canvas!.width = window.innerWidth;
      height = canvas!.height = window.innerHeight;
    }

    function initParticles() {
      particles = [];
      const count = Math.min(Math.floor(width / 10), 100);
      for (let i = 0; i < count; i++) {
        const depth = Math.random();
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height - height,
          size: 2 + depth * 8,
          speedY: 0.2 + depth * 1.2,
          speedX: (Math.random() - 0.5) * (0.3 + depth * 1.5),
          color: colors[Math.floor(Math.random() * colors.length)],
          angle: Math.random() * 360,
          spin: (Math.random() - 0.5) * 0.05,
          opacity: 0.1 + depth * 0.5,
          depth,
          driftAmp: 5 + depth * 25,
          driftSpeed: 0.3 + Math.random() * 0.8,
        });
      }
    }

    function animateParticles() {
      ctx!.clearRect(0, 0, width, height);
      const t = performance.now() * 0.001;
      for (const p of particles) {
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(t * p.driftSpeed + p.angle) * p.driftAmp * 0.01;
        p.angle += p.spin;

        const mouseOffset = (mouseX - width / 2) * 0.002 * p.depth;
        const drawX = p.x + mouseOffset;

        if (p.y > height + 20) { p.y = -20; p.x = Math.random() * width; }
        if (p.x > width + 20) p.x = -20;
        if (p.x < -20) p.x = width + 20;

        ctx!.save();
        ctx!.translate(drawX, p.y);
        ctx!.rotate(p.angle);
        ctx!.globalAlpha = p.opacity;
        ctx!.fillStyle = p.color;
        ctx!.beginPath();
        ctx!.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
      }
      rafRef.current = requestAnimationFrame(animateParticles);
    }

    resize();
    initParticles();
    animateParticles();

    const onResize = () => { resize(); initParticles(); };
    const onMouseMove = (e: MouseEvent) => { mouseX = e.clientX; };
    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  useEffect(() => {
    const elements = document.querySelectorAll(".fade-up-element");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "0px", threshold: 0.1 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-black text-white antialiased overflow-hidden selection:bg-[#d4af37] selection:text-white"
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      <style>{`
        .glass-panel {
          background: rgba(254, 252, 207, 0.4);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 253, 208, 0.3);
          box-shadow: 0 20px 40px rgba(75, 35, 0, 0.08), inset 0 1px 0 rgba(212, 175, 55, 0.2);
        }
        .gold-shimmer-text {
          background: linear-gradient(to right, #ffffff 20%, #d4af37 40%, #e9c349 50%, #d4af37 60%, #ffffff 80%);
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: shine 5s linear infinite;
        }
        @keyframes shine { to { background-position: 200% center; } }
        .slow-spin { animation: spin 50s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .pulse-glow { animation: pulse-glow 4s ease-in-out infinite; }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 40px rgba(212, 175, 55, 0.2); }
          50% { box-shadow: 0 0 80px rgba(212, 175, 55, 0.4); }
        }
        .fade-up-element {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 1s cubic-bezier(0.2, 0.8, 0.2, 1), transform 1s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .fade-up-element.visible { opacity: 1; transform: translateY(0); }
        .gold-gradient-btn {
          background: linear-gradient(135deg, #d4af37 0%, #e9c349 50%, #ff9b3f 100%);
          position: relative;
          overflow: hidden;
        }
        .gold-gradient-btn::after {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 50%; height: 100%;
          background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0) 100%);
          transform: skewX(-25deg);
          transition: all 0.7s ease;
        }
        .gold-gradient-btn:hover::after { left: 200%; }
        .ambient-bg {
          background: radial-gradient(circle at 20% 30%, rgba(42, 106, 63, 0.15) 0%, transparent 50%),
                      radial-gradient(circle at 80% 70%, rgba(212, 175, 55, 0.1) 0%, transparent 50%);
        }
      `}</style>

      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none z-10" />

      <main className="ambient-bg">
        {/* HERO SECTION */}
        <section className="relative min-h-screen flex items-center justify-center pt-24 overflow-hidden">
          {/* Video background */}
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover z-0 opacity-85"
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260330_153826_e9005cf7-a1c7-4c7d-886f-fea22d644a9c.mp4"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black z-[1]" />
          <div className="relative w-full max-w-[1280px] mx-auto px-5 md:px-16 flex flex-col items-center justify-center text-center z-10">
            <div className="relative w-[217px] h-[217px] md:w-[434px] md:h-[434px] mb-12">
              <div className="absolute inset-0 rounded-full pulse-glow blur-xl bg-[#d4af37]/20" />
              <img
                alt="Pookkalam"
                className="w-full h-full object-cover rounded-full slow-spin shadow-[0_20px_60px_rgba(212,175,55,0.3),0_0_40px_rgba(212,175,55,0.15)] ring-1 ring-[#d4af37]/30 relative z-10"
                style={{ filter: "blur(0.5px) drop-shadow(0 8px 24px rgba(212,175,55,0.25))" }}
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDvjW-XERYAlJGtjXmL3IK48bKBjxMml7yezfht-YbZfFIwGpQoz8gdGB1I-27RRa7AYB4qqafLP2Kw4dlj9pAnWuUP460qNsqoxSnGenU_tJFJeJ9FgchFACK_FNaguM_-pim_YDlObxVp1dmDakxBK-GnHRAp-fhoSudMJ1O_Lka5ClX_FLVW-HPqpeqaIOOLrFdcPB8g4OmxNw204OR8ns4tjJdjguQxWteQvpkZIPNwu4AeKSeNCw"
              />
            </div>
            <h1 className="text-[48px] md:text-[64px] leading-[72px] tracking-[-0.02em] font-bold gold-shimmer-text mb-6"
              style={{ fontFamily: "var(--font-valve)" }}>
              Happy Onam
            </h1>
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 fade-up-element leading-[28px]">
              Step into the ethereal beauty of Kerala&apos;s grandest festival. A season of harmony, heritage, and the legendary homecoming of Mahabali.
            </p>
            <button className="gold-gradient-btn text-white px-8 py-4 rounded-full text-sm font-semibold shadow-[0_12px_24px_rgba(212,175,55,0.4)] hover:shadow-[0_16px_32px_rgba(212,175,55,0.6)] transition-all duration-300 fade-up-element tracking-wide">
              Discover the Heritage
            </button>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black to-transparent z-10" />
        </section>
      </main>
    </div>
  );
}
