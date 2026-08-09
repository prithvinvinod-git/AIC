import dynamic from "next/dynamic";
import HeroAuthCard from "@/components/home/HeroAuthCard";

const DotGrid = dynamic(() => import("@/components/home/DotGrid"), { ssr: false });

/** Split hero — fills the first viewport; "How it works" follows below the fold. */
export default function PublicHero() {
  return (
    <section className="relative flex min-h-[100svh] w-full items-center overflow-hidden px-4 pb-14 pt-[112px] sm:px-6">
      <div className="absolute inset-0 -z-10">
        <DotGrid
          dotSize={8}
          gap={18}
          baseColor="#e2e2e7"
          activeColor="#0099ff"
          proximity={120}
          shockRadius={220}
          shockStrength={4}
          resistance={800}
          returnDuration={1.4}
        />
      </div>
      <div className="mx-auto grid w-full max-w-[1200px] -mt-[200px] items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h1 className="font-valve text-6xl leading-tight tracking-tight text-ink sm:text-7xl">
            Report it once.
            <br />
            Watch it close.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate">
            A governed, AI-assisted workflow for professional campus upkeep — from a leak in
            Block&nbsp;C to a full electrical audit.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#how-it-works" className="btn btn-secondary btn-lg">
              Explore how it works
            </a>
          </div>
        </div>

        <div className="w-full max-w-md justify-self-center lg:justify-self-end">
          <HeroAuthCard />
        </div>
      </div>

      <div className="absolute bottom-[106px] left-1/2 -translate-x-1/2">
        <div className="animate-scroll-pill flex items-center gap-2.5 rounded-full border border-silver bg-white/80 px-[34px] py-3 text-sm font-medium text-slate backdrop-blur">
          Scroll down
          <svg
            className="h-[25px] w-[25px] animate-bounce"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </div>
    </section>
  );
}
