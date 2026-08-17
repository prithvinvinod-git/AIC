"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { EasterEggEvent } from "@/lib/types";
import { EASTER_EGG_META } from "@/lib/types";

import RepublicDay from "./republic-day";
import IndependenceDay from "./independence-day";
import Onam from "./onam";
import Christmas from "./christmas";
import Eid from "./eid";
import Holi from "./holi";
import Easter from "./easter";
import EnvironmentDay from "./environment-day";
import EngineersDay from "./engineers-day";
import FreshersDay from "./freshers-day";
import TechFest from "./tech-fest";

const EVENT_COMPONENTS: Record<EasterEggEvent, React.ComponentType> = {
  "republic-day": RepublicDay,
  "independence-day": IndependenceDay,
  "onam": Onam,
  "christmas": Christmas,
  "eid": Eid,
  "holi": Holi,
  "easter": Easter,
  "environment-day": EnvironmentDay,
  "engineers-day": EngineersDay,
  "freshers-day": FreshersDay,
  "tech-fest": TechFest,
};

export default function EventPage({ slug }: { slug: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setShow(true));
  }, []);

  if (!(slug in EVENT_COMPONENTS)) return null;

  const EventComponent = EVENT_COMPONENTS[slug as EasterEggEvent];
  const meta = EASTER_EGG_META[slug as EasterEggEvent];

  return (
    <div
      className={`min-h-screen transition-opacity duration-700 ${show ? "opacity-100" : "opacity-0"}`}
    >
      <Link
        href="/"
        className="fixed left-4 top-4 z-50 flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-black/30"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Back
      </Link>

      <div className="fixed right-4 top-4 z-50">
        <span className="rounded-full bg-black/20 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm flex items-center gap-1.5">
          <meta.Icon className="h-3.5 w-3.5" aria-hidden />
          {meta.label}
        </span>
      </div>

      <EventComponent />
    </div>
  );
}
