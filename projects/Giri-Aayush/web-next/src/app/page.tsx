"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { useViz } from "@/lib/store";
import GraphCanvas from "@/components/GraphCanvas";
import StatsBar from "@/components/StatsBar";
import ControlPanel from "@/components/ControlPanel";
import Timeline from "@/components/Timeline";
import Tooltip from "@/components/Tooltip";

// cinematic rise-and-unblur, spring-settled
const rise = (dir: "left" | "top" | "bottom", delay: number) => ({
  initial: { opacity: 0, filter: "blur(7px)", ...(dir === "left" ? { x: -26 } : { y: dir === "top" ? -22 : 30 }) },
  animate: { opacity: 1, filter: "blur(0px)", x: 0, y: 0 },
  transition: { type: "spring" as const, stiffness: 90, damping: 17, delay },
});

export default function Home() {
  const load = useViz((s) => s.load);
  const data = useViz((s) => s.data);
  useEffect(() => { load(); }, [load]);

  return (
    <main className="relative h-full w-full overflow-hidden bg-canvas">
      {/* ambient gold glow + grain */}
      <div
        className="breathe pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 70% at 52% 42%, rgba(90,110,180,0.10), transparent 60%)," +
            "radial-gradient(60% 50% at 52% 42%, rgba(244,183,40,0.05), transparent 65%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-40 opacity-[0.035] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* graph fills the stage */}
      <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2, ease: "easeOut" }}>
        {data ? <GraphCanvas /> : <Loading />}
      </motion.div>

      {/* floating chrome — spring-staggered entrance */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-4">
          <motion.div {...rise("left", 0.15)}><ControlPanel /></motion.div>
          <motion.div {...rise("top", 0.3)}><StatsBar /></motion.div>
        </div>
        <div className="flex justify-center">
          <motion.div className="pointer-events-auto w-full max-w-[1180px]" {...rise("bottom", 0.45)}>
            <Timeline />
          </motion.div>
        </div>
      </div>

      <Tooltip />
    </main>
  );
}

function Loading() {
  return (
    <div className="grid h-full place-items-center">
      <span className="label animate-pulse">Loading the decade…</span>
    </div>
  );
}
