"use client";

import { create } from "zustand";
import type { ColorBy, GraphDoc, Mode, SizeBy } from "./graph";

type VizState = {
  data: GraphDoc | null;
  month: number;
  mode: Mode;
  windowSize: number;
  colorBy: ColorBy;
  sizeBy: SizeBy;
  sizeScale: number;
  minWeight: number;
  showBots: boolean;
  playing: boolean;
  selected: string | null;
  hovered: string | null;

  load: () => Promise<void>;
  set: <K extends keyof VizState>(k: K, v: VizState[K]) => void;
  setMonth: (m: number) => void;
  togglePlay: () => void;
};

export const useViz = create<VizState>((setState, get) => ({
  data: null,
  month: 0,
  mode: "cumulative",
  windowSize: 12,
  colorBy: "community",
  sizeBy: "commits",
  sizeScale: 1,
  minWeight: 1,
  showBots: false,
  playing: false,
  selected: null,
  hovered: null,

  load: async () => {
    if (get().data) return;
    const res = await fetch("graph.json");
    const data: GraphDoc = await res.json();
    for (const l of data.links) {
      l.s = l.source;
      l.t = l.target;
    }
    // open decluttered on large archives: default tie-strength to the ~1500th edge
    let minWeight = 1;
    if (data.links.length > 1800) {
      const sorted = [...data.links].sort((a, b) => b.weight - a.weight);
      minWeight = Math.max(1, sorted[1800].weight);
    }
    setState({ data, month: data.meta.n_months - 1, minWeight });
  },
  set: (k, v) => setState({ [k]: v } as Partial<VizState>),
  setMonth: (m) => setState({ month: m }),
  togglePlay: () => setState((s) => ({ playing: !s.playing })),
}));
