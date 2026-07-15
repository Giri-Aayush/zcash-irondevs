"use client";

import { useEffect } from "react";
import { useViz } from "@/lib/store";
import GraphCanvas from "@/components/GraphCanvas";
import StatsBar from "@/components/StatsBar";
import ControlPanel from "@/components/ControlPanel";
import Timeline from "@/components/Timeline";
import Tooltip from "@/components/Tooltip";

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
      <div className="absolute inset-0 animate-in fade-in duration-1000">
        {data ? <GraphCanvas /> : <Loading />}
      </div>

      {/* floating chrome — staggered entrance */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="animate-in fade-in slide-in-from-left-6 fill-mode-both delay-100 duration-700 ease-out">
            <ControlPanel />
          </div>
          <div className="animate-in fade-in slide-in-from-top-4 fill-mode-both delay-200 duration-700 ease-out">
            <StatsBar />
          </div>
        </div>
        <div className="flex justify-center">
          <div className="pointer-events-auto w-full max-w-[1180px] animate-in fade-in slide-in-from-bottom-8 fill-mode-both delay-300 duration-700 ease-out">
            <Timeline />
          </div>
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
