"use client";

import { useMemo, useState } from "react";
import { useViz } from "@/lib/store";
import { buildColorModel } from "@/lib/graph";
import { Slider } from "@/components/ui/slider";
import { Segmented } from "./Segmented";

const num = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : (v as number));

export default function ControlPanel() {
  const { data, colorBy, sizeScale, minWeight, set } = useViz();
  const [q, setQ] = useState("");

  const clusters = useMemo(
    () => (data ? buildColorModel(data.nodes, colorBy).clusters : []),
    [data, colorBy]
  );
  const maxWeight = useMemo(
    () => (data ? Math.min(40, Math.max(8, Math.max(...data.links.map((l) => l.weight)))) : 20),
    [data]
  );
  const hits = useMemo(() => {
    if (!data || !q.trim()) return [];
    const s = q.trim().toLowerCase();
    return data.nodes.filter((n) => n.name.toLowerCase().includes(s)).slice(0, 6);
  }, [data, q]);

  if (!data) return null;

  return (
    <div className="glass pointer-events-auto flex w-[264px] flex-col gap-4 p-3.5">
      {/* header */}
      <div className="flex items-center gap-2.5">
        <div className="grid size-9 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold shadow-[0_0_16px_-4px_var(--gold)]">
          <span className="text-[15px]">◈</span>
        </div>
        <div>
          <h1 className="font-display text-[15px] leading-tight font-semibold">Ten Years of Zcash</h1>
          <p className="label mt-0.5" style={{ letterSpacing: "0.06em" }}>
            Co-authorship network · {data.meta.months[0]} → {data.meta.months.at(-1)}
          </p>
        </div>
      </div>

      {/* search */}
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search contributors"
          className="mono w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12px] text-foreground placeholder:text-foreground/35 outline-none focus:border-gold/40"
        />
        {hits.length > 0 && (
          <div className="glass absolute top-full left-0 right-0 z-20 mt-1.5 flex flex-col gap-0.5 p-1">
            {hits.map((n) => (
              <button
                key={n.id}
                onClick={() => { set("selected", n.id); setQ(""); }}
                className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-[12px] text-foreground/70 hover:bg-white/[0.05] hover:text-foreground"
              >
                <span className="truncate">{n.name}</span>
                <span className="mono tnum text-foreground/35">{n.commits.toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* color by */}
      <div className="flex flex-col gap-2">
        <span className="label">Color by</span>
        <Segmented
          value={colorBy}
          onChange={(v) => set("colorBy", v)}
          options={[{ value: "community", label: "Cluster" }, { value: "org", label: "Org" }]}
        />
      </div>

      {/* node size */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="label">Node size</span>
          <span className="mono tnum text-[11px] text-gold">{sizeScale.toFixed(2)}×</span>
        </div>
        <Slider min={0.5} max={2} step={0.25} value={[sizeScale]} onValueChange={(v) => set("sizeScale", num(v))} />
      </div>

      {/* min tie strength */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="label">Min tie strength</span>
          <span className="mono tnum text-[11px] text-gold">{minWeight}</span>
        </div>
        <Slider min={1} max={maxWeight} step={1} value={[minWeight]} onValueChange={(v) => set("minWeight", num(v))} />
      </div>

      {/* clusters */}
      <div className="flex flex-col gap-2">
        <span className="label">{colorBy === "community" ? "Clusters" : "Organizations"}</span>
        <div className="flex flex-col gap-1.5">
          {clusters.map((c) => (
            <div key={String(c.key)} className="flex items-center gap-2.5 text-[12px]">
              <span className="size-2.5 flex-none rounded-[3px]" style={{ background: c.color, boxShadow: `0 0 8px -2px ${c.color}` }} />
              <span className="truncate text-foreground/80">{c.label}</span>
              <span className="mono tnum ml-auto text-foreground/40">{c.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
