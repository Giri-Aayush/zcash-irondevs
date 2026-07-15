"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { useViz } from "@/lib/store";
import {
  buildColorModel,
  linkWeight,
  nodeCommits,
  type GLink,
  type GNode,
} from "@/lib/graph";

export default function GraphCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const sim = useRef<d3.Simulation<GNode, GLink> | null>(null);
  const refs = useRef<any>({});

  const {
    data, month, mode, windowSize, colorBy, sizeScale, minWeight, showBots, selected,
  } = useViz();

  // ── one-time setup ──
  useEffect(() => {
    if (!svgRef.current || !data) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const rect = svgRef.current.getBoundingClientRect();
    svg.attr("viewBox", `0 0 ${rect.width} ${rect.height}`);

    const defs = svg.append("defs");
    // reusable glossy sheen (white top-left highlight) for sphere bubbles
    const sheen = defs.append("radialGradient").attr("id", "sheen").attr("cx", "34%").attr("cy", "28%").attr("r", "62%");
    sheen.append("stop").attr("offset", "0%").attr("stop-color", "#ffffff").attr("stop-opacity", 0.5);
    sheen.append("stop").attr("offset", "100%").attr("stop-color", "#ffffff").attr("stop-opacity", 0);
    // muted navy "background sea" bubble
    const mut = defs.append("radialGradient").attr("id", "muted").attr("cx", "36%").attr("cy", "30%").attr("r", "75%");
    mut.append("stop").attr("offset", "0%").attr("stop-color", "#28324c");
    mut.append("stop").attr("offset", "60%").attr("stop-color", "#151b2b");
    mut.append("stop").attr("offset", "100%").attr("stop-color", "#0b1019");
    // arrowhead for strong ties
    const marker = defs.append("marker").attr("id", "arrow").attr("viewBox", "0 0 10 10")
      .attr("refX", 8).attr("refY", 5).attr("markerWidth", 5).attr("markerHeight", 5).attr("orient", "auto");
    marker.append("path").attr("d", "M0,1 L9,5 L0,9").attr("fill", "none").attr("stroke", "#8792b5").attr("stroke-width", 1.4);
    const zoomG = svg.append("g");
    const gLink = zoomG.append("g").attr("stroke", "#4a5573");
    const gNode = zoomG.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 6])
      .on("zoom", (e) => zoomG.attr("transform", e.transform));
    svg.call(zoom as any);

    const byId = new Map<string, GNode>(data.nodes.map((n) => [n.id, n]));

    const simulation = d3
      .forceSimulation<GNode, GLink>()
      .alphaDecay(0.03)
      .velocityDecay(0.42)
      .force("charge", d3.forceManyBody().strength(-620).distanceMax(900))
      .force("link", d3.forceLink<GNode, GLink>().id((d: any) => d.id)
        .distance((l: any) => 120 / Math.sqrt(l.w || 1)).strength(0.25))
      .force("center", d3.forceCenter(rect.width / 2, rect.height / 2))
      .force("collide", d3.forceCollide<GNode>().radius((d) => (d.r || 4) + 12).strength(0.9))
      .force("x", d3.forceX(rect.width / 2).strength(0.012))
      .force("y", d3.forceY(rect.height / 2).strength(0.012))
      .on("tick", () => {
        gLink.selectAll<SVGLineElement, GLink>("line").each(function (l) {
          const a = byId.get(l.s!)!, b = byId.get(l.t!)!;
          const dx = b.x! - a.x!, dy = b.y! - a.y!, len = Math.hypot(dx, dy) || 1;
          const ux = dx / len, uy = dy / len;
          const line = this as SVGLineElement;
          line.setAttribute("x1", String(a.x! + ux * ((a.r || 4) + 2)));
          line.setAttribute("y1", String(a.y! + uy * ((a.r || 4) + 2)));
          line.setAttribute("x2", String(b.x! - ux * ((b.r || 4) + 7)));
          line.setAttribute("y2", String(b.y! - uy * ((b.r || 4) + 7)));
        });
        gNode.selectAll<SVGGElement, GNode>("g.node").attr("transform", (n) => `translate(${n.x},${n.y})`);
        // fit once the layout has actually settled (not mid-explosion)
        if (!refs.current.didFit && simulation.alpha() < 0.06) {
          refs.current.didFit = true;
          fitView(600);
        }
      });
    sim.current = simulation;

    refs.current = { svg, defs, zoomG, gLink, gNode, zoom, byId, patterns: new Set<string>() };

    const onResize = () => {
      const r = svgRef.current!.getBoundingClientRect();
      svg.attr("viewBox", `0 0 ${r.width} ${r.height}`);
      simulation.force("center", d3.forceCenter(r.width / 2, r.height / 2));
    };
    window.addEventListener("resize", onResize);

    update();
    return () => {
      window.removeEventListener("resize", onResize);
      simulation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // ── react to control changes ──
  useEffect(() => { if (sim.current) update(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, mode, windowSize, colorBy, sizeScale, minWeight, showBots]);

  useEffect(() => { if (sim.current) applyHighlight(selected); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function avatarFill(n: GNode) {
    const { defs, patterns } = refs.current;
    const pid = "av-" + (n.avatar || "").replace(/\W/g, "");
    if (!patterns.has(pid)) {
      patterns.add(pid);
      const p = defs.append("pattern").attr("id", pid)
        .attr("patternContentUnits", "objectBoundingBox").attr("width", 1).attr("height", 1);
      p.append("image").attr("href", n.avatar).attr("width", 1).attr("height", 1)
        .attr("preserveAspectRatio", "xMidYMid slice");
    }
    return `url(#${pid})`;
  }

  // Bubblemaps-style glossy sphere + colored glow halo, one gradient pair per color
  function grads(color: string) {
    const { defs, patterns } = refs.current;
    const key = "g" + color.replace(/\W/g, "");
    if (!patterns.has(key)) {
      patterns.add(key);
      const glow = defs.append("radialGradient").attr("id", "glow" + key);
      glow.append("stop").attr("offset", "0%").attr("stop-color", color).attr("stop-opacity", 0.6);
      glow.append("stop").attr("offset", "70%").attr("stop-color", color).attr("stop-opacity", 0.12);
      glow.append("stop").attr("offset", "100%").attr("stop-color", color).attr("stop-opacity", 0);
      const c = d3.color(color)!;
      const sph = defs.append("radialGradient").attr("id", "sph" + key).attr("cx", "36%").attr("cy", "30%").attr("r", "75%");
      sph.append("stop").attr("offset", "0%").attr("stop-color", String(c.brighter(1.1)));
      sph.append("stop").attr("offset", "58%").attr("stop-color", color);
      sph.append("stop").attr("offset", "100%").attr("stop-color", String(c.darker(1.4)));
    }
    return { glow: `url(#glow${key})`, sphere: `url(#sph${key})` };
  }

  function visible() {
    const st = useViz.getState();
    const nodes: GNode[] = [];
    const nodeC = new Map<string, number>();
    for (const n of data!.nodes) {
      if (n.is_bot && !st.showBots) continue;
      const c = nodeCommits(n, st.month, st.mode, st.windowSize);
      if (c <= 0) continue;
      nodeC.set(n.id, c);
      nodes.push(n);
    }
    const vis = new Set(nodes.map((n) => n.id));
    const links: GLink[] = [];
    const degree = new Map<string, number>();
    for (const l of data!.links) {
      if (!vis.has(l.s!) || !vis.has(l.t!)) continue;
      const w = linkWeight(l, st.month, st.mode, st.windowSize);
      if (w < st.minWeight) continue;
      l.w = w;
      links.push(l);
      degree.set(l.s!, (degree.get(l.s!) || 0) + 1);
      degree.set(l.t!, (degree.get(l.t!) || 0) + 1);
    }
    // keep everyone: connected people are vivid, the rest form a muted background sea
    return { nodes, links, nodeC, degree };
  }

  function update() {
    const st = useViz.getState();
    const { gNode, gLink, byId } = refs.current;
    const { nodes, links, nodeC, degree } = visible();
    const model = buildColorModel(data!.nodes, st.colorBy);
    const color = (n: GNode) => model.color(n);

    const val = (n: GNode) => nodeC.get(n.id) || 0;
    const scale = st.sizeScale;
    // dramatic size for connected "whale" contributors; muted sea stays small
    const connMax = d3.max(nodes.filter((n) => (degree.get(n.id) || 0) > 0), val) || 1;
    const rConn = d3.scaleSqrt().domain([0, connMax]).range([13, 46]);
    const rMuted = d3.scaleSqrt().domain([0, d3.max(nodes, val) || 1]).range([3.5, 9]);
    const radius = (n: GNode) => ((degree.get(n.id) || 0) > 0 ? rConn(val(n)) : rMuted(val(n))) * scale;

    const rect = svgRef.current!.getBoundingClientRect();
    const prev = new Set(sim.current!.nodes().map((n) => n.id));
    let added = 0;
    for (const l of links) {
      const na = byId.get(l.s!), nb = byId.get(l.t!);
      if (na && na.x == null && nb && nb.x != null) { na.x = nb.x + (Math.random() - 0.5) * 40; na.y = nb.y! + (Math.random() - 0.5) * 40; }
    }
    for (const n of nodes) {
      if (n.x == null) { n.x = rect.width / 2 + (Math.random() - 0.5) * 80; n.y = rect.height / 2 + (Math.random() - 0.5) * 80; }
      n.deg = degree.get(n.id) || 0;
      n.r = radius(n);
      if (!prev.has(n.id)) added++;
    }

    gLink.selectAll<SVGLineElement, GLink>("line")
      .data(links, (l: any) => l.s + "|" + l.t)
      .join(
        (enter: any) => enter.append("line").attr("class", "link").attr("marker-end", "url(#arrow)"),
        (u: any) => u,
        (exit: any) => exit.remove()
      )
      .attr("stroke-opacity", 0.34)
      .attr("stroke-width", (l: GLink) => Math.min(2.4, 0.35 + Math.sqrt(l.w!) * 0.4));

    const nodeSel = gNode.selectAll<SVGGElement, GNode>("g.node")
      .data(nodes, (n: any) => n.id)
      .join(
        (enter: any) => {
          const g = enter.append("g").attr("class", "node").style("cursor", "pointer");
          g.append("circle").attr("class", "halo").attr("pointer-events", "none");   // colored glow
          g.append("circle").attr("class", "body");                                   // sphere / avatar
          g.append("circle").attr("class", "sheen").attr("pointer-events", "none");    // glossy highlight
          g.call(drag());
          g.on("mouseenter", (_e: any, n: GNode) => { useViz.getState().set("hovered", n.id); if (!useViz.getState().selected) applyHighlight(n.id); })
            .on("mouseleave", () => { useViz.getState().set("hovered", null); if (!useViz.getState().selected) applyHighlight(null); })
            .on("click", (e: any, n: GNode) => { e.stopPropagation(); const cur = useViz.getState().selected; useViz.getState().set("selected", cur === n.id ? null : n.id); });
          return g;
        },
        (u: any) => u,
        (exit: any) => exit.remove()
      );
    const conn = (n: GNode) => (n.deg || 0) > 0;
    nodeSel.select("circle.halo")
      .attr("r", (n: GNode) => n.r! * 2.1)
      .attr("fill", (n: GNode) => grads(color(n)).glow)
      .attr("opacity", (n: GNode) => (conn(n) ? (n.is_bot ? 0.3 : 0.95) : 0)); // muted sea has no glow
    nodeSel.select("circle.body")
      .attr("r", (n: GNode) => n.r!)
      .attr("fill", (n: GNode) => (!conn(n) ? "url(#muted)" : n.avatar ? avatarFill(n) : grads(color(n)).sphere))
      .attr("fill-opacity", (n: GNode) => (!conn(n) ? 0.5 : n.is_bot ? 0.5 : 1))
      .attr("stroke", (n: GNode) => (conn(n) ? color(n) : "#2b3450"))
      .attr("stroke-opacity", (n: GNode) => (conn(n) ? 0.95 : 0.5))
      .attr("stroke-width", (n: GNode) => (conn(n) ? Math.max(1.6, n.r! * 0.13) : 1));
    nodeSel.select("circle.sheen")
      .attr("r", (n: GNode) => n.r! * 0.86)
      .attr("cx", (n: GNode) => -n.r! * 0.12)
      .attr("cy", (n: GNode) => -n.r! * 0.14)
      .attr("fill", "url(#sheen)")
      .attr("opacity", (n: GNode) => (!conn(n) ? 0.35 : n.avatar ? 0.16 : 0.5));

    refs.current.svg.on("click", () => useViz.getState().set("selected", null));

    sim.current!.nodes(nodes);
    (sim.current!.force("link") as d3.ForceLink<GNode, GLink>).links(links);
    sim.current!.alpha(Math.min(0.6, 0.1 + added / 35)).restart();

    if (st.selected) applyHighlight(st.selected);
  }

  function neighborWeights(id: string) {
    const w = new Map<string, number>();
    for (const l of (sim.current!.force("link") as d3.ForceLink<GNode, GLink>).links() as GLink[]) {
      if (l.s === id) w.set(l.t!, l.w!);
      else if (l.t === id) w.set(l.s!, l.w!);
    }
    return w;
  }

  function applyHighlight(id: string | null) {
    const { gNode, gLink } = refs.current;
    gNode.selectAll<SVGGElement, GNode>("g.node").selectAll("text.lbl").remove();
    const cm = buildColorModel(data!.nodes, useViz.getState().colorBy);
    if (!id) {
      gNode.selectAll<SVGGElement, GNode>("g.node").style("opacity", 1);
      gNode.selectAll<SVGCircleElement, GNode>("circle.body")
        .attr("stroke", (n) => cm.color(n)).attr("stroke-opacity", 0.95)
        .attr("stroke-width", (n) => Math.max(1.4, n.r! * 0.14));
      gLink.selectAll("line").attr("stroke-opacity", 0.32);
      return;
    }
    const w = neighborWeights(id);
    const keep = new Set(w.keys()); keep.add(id);
    gNode.selectAll<SVGGElement, GNode>("g.node").style("opacity", (n) => (keep.has(n.id) ? 1 : 0.1));
    gNode.selectAll<SVGGElement, GNode>("g.node").filter((n) => n.id === id)
      .select("circle.body").attr("stroke", "#ffffff").attr("stroke-opacity", 1).attr("stroke-width", (n) => Math.max(2, n.r! * 0.16));
    gLink.selectAll<SVGLineElement, GLink>("line").attr("stroke-opacity", (l) => (l.s === id || l.t === id ? 0.6 : 0.03));
    const top = [...w.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map((d) => d[0]);
    const labels = new Set(top); labels.add(id);
    gNode.selectAll<SVGGElement, GNode>("g.node").filter((n) => labels.has(n.id))
      .append("text").attr("class", "lbl")
      .attr("x", (n) => n.r! + 4).attr("y", 3)
      .attr("font-family", "var(--font-mono), monospace").attr("font-size", 10).attr("fill", "#ede7dc")
      .attr("paint-order", "stroke").attr("stroke", "#0c0b0a").attr("stroke-width", 3.5).attr("stroke-linejoin", "round")
      .text((n) => n.name);
  }

  function drag() {
    return d3.drag<SVGGElement, GNode>()
      .on("start", (e, d) => { if (!e.active) sim.current!.alphaTarget(0.2).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on("end", (e, d) => { if (!e.active) sim.current!.alphaTarget(0); d.fx = null; d.fy = null; });
  }

  function fitView(dur = 600) {
    const all = sim.current!.nodes().filter((n) => n.x != null);
    // frame the connected core; the muted background sea spills past the edges
    const conn = all.filter((n) => (n.deg || 0) > 0);
    const nodes = conn.length >= 3 ? conn : all;
    if (!nodes.length) return;
    const xs = nodes.map((n) => n.x!).sort(d3.ascending);
    const ys = nodes.map((n) => n.y!).sort(d3.ascending);
    const maxR = d3.max(nodes, (n) => n.r || 8) || 8;
    const pad = 40 + maxR; // don't clip big whale bubbles at the edges
    const x0 = d3.quantileSorted(xs, 0.05)! - pad, x1 = d3.quantileSorted(xs, 0.95)! + pad;
    const y0 = d3.quantileSorted(ys, 0.05)! - pad, y1 = d3.quantileSorted(ys, 0.95)! + pad;
    const rect = svgRef.current!.getBoundingClientRect();
    const k = Math.max(0.3, Math.min(3, 0.68 * Math.min(rect.width / (x1 - x0), rect.height / (y1 - y0))));
    const tx = (rect.width - k * (x0 + x1)) / 2;
    const ty = (rect.height - k * (y0 + y1)) / 2;
    refs.current.svg.transition().duration(dur).call(
      refs.current.zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(k)
    );
  }

  // expose fit for the store-driven "reset" (used after play ends)
  useEffect(() => { refs.current.fitView = fitView; });

  return <svg ref={svgRef} className="h-full w-full block" style={{ cursor: "grab" }} />;
}
