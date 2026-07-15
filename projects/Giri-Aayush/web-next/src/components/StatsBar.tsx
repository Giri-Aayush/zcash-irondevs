"use client";

import { useMemo } from "react";
import { useViz } from "@/lib/store";
import { computeStats } from "@/lib/graph";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-3.5">
      <span className="label">{label}</span>
      <span className="font-display tnum text-[19px] leading-none font-semibold text-foreground">{value}</span>
    </div>
  );
}

function Growth() {
  const data = useViz((s) => s.data);
  const month = useViz((s) => s.month);
  if (!data) return null;
  const series = data.timeline.map((t) => t.nodes);
  const W = 74, H = 26, max = Math.max(...series, 1);
  const x = (i: number) => (i / (series.length - 1)) * W;
  const y = (v: number) => H - 3 - (v / max) * (H - 6);
  const path = series.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <div className="flex flex-col gap-1 px-3.5">
      <span className="label">Growth</span>
      <svg width={W} height={H} className="overflow-visible">
        <path d={path} fill="none" stroke="var(--gold)" strokeWidth={1.5} />
        <circle cx={x(month)} cy={y(series[month])} r={2.4} fill="var(--gold)" />
      </svg>
    </div>
  );
}

export default function StatsBar() {
  const { data, month, mode, windowSize, minWeight, showBots } = useViz();
  const s = useMemo(
    () => (data ? computeStats(data, month, mode, windowSize, minWeight, showBots) : null),
    [data, month, mode, windowSize, minWeight, showBots]
  );
  if (!s) return null;
  const fmt = (n: number) => n.toLocaleString("en-US");
  return (
    <div className="glass pointer-events-auto flex items-stretch divide-x divide-white/[0.06] py-2.5">
      <Stat label="People" value={fmt(s.people)} />
      <Stat label="Ties" value={fmt(s.ties)} />
      <Stat label="Commits" value={fmt(s.commits)} />
      <Stat label="Density" value={`${(s.density * 100).toFixed(1)}%`} />
      <Growth />
    </div>
  );
}
