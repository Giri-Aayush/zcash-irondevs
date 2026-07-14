/* Ten Years of Zcash — dynamic co-authorship network.
 * Reads graph.json (produced by the Python pipeline) and renders an animated,
 * time-sliceable force-directed network with D3. */

const PALETTE = (document.body.dataset.palette || "").split(",").map((s) => s.trim()).filter(Boolean);
const GOLD = "#fdc63e";
const OTHER = "#6b6b64";

// Zcash network upgrades — the story beats on the timeline.
const MILESTONES = [
  ["2016-10", "Sprout · mainnet launch"],
  ["2018-10", "Sapling"],
  ["2020-07", "Heartwood"],
  ["2020-11", "Canopy"],
  ["2022-05", "NU5 · Orchard & unified addresses"],
  ["2024-11", "NU6"],
  ["2026-07", "Ironwood ◈"],
];

const el = (id) => document.getElementById(id);
const fmt = (n) => d3.format(",")(n);

let G, MONTHS, NBYID;
let state = {
  month: 0,
  mode: "cumulative",
  window: 12,
  colorBy: "community",
  sizeBy: "commits",
  minWeight: 1,
  showBots: false,
  playing: false,
  selected: null,
};
let colorScale, communityLabels, orgList;
let sim, gLink, gNode, zoomG, zoomBehavior, defs;
let playTimer = null;
const avatarPatterns = new Set();

/* lazily register an SVG pattern that paints a contributor's avatar into a circle */
function avatarFill(n) {
  const pid = "av-" + n.avatar.replace(/\W/g, "");
  if (!avatarPatterns.has(pid)) {
    avatarPatterns.add(pid);
    const p = defs.append("pattern").attr("id", pid)
      .attr("patternContentUnits", "objectBoundingBox").attr("width", 1).attr("height", 1);
    p.append("image").attr("href", n.avatar).attr("width", 1).attr("height", 1)
      .attr("preserveAspectRatio", "xMidYMid slice");
  }
  return `url(#${pid})`;
}

init();

async function init() {
  G = await fetch("graph.json").then((r) => r.json());
  MONTHS = G.meta.months;
  NBYID = new Map(G.nodes.map((n) => [n.id, n]));
  state.month = MONTHS.length - 1;

  // link endpoints -> node object refs; keep raw ids too
  G.links.forEach((l) => {
    l.s = l.source;
    l.t = l.target;
  });

  setupColorDomains();
  setupSVG();
  setupTimeline();
  setupControls();
  applyURLState();
  el("meta-line").textContent =
    `${fmt(G.meta.n_commits)} commits · ${fmt(G.meta.n_contributors)} people · ${G.meta.repos.length} repos`;

  update(true);
  const snap = new URLSearchParams(location.search).has("snap");
  // settle longer, then fit; snapshot mode fits instantly for headless capture
  setTimeout(() => fitView(snap ? 0 : 800), snap ? 2600 : 1700);
}

/* ───────────────────────── color ───────────────────────── */
function setupColorDomains() {
  // communities ranked by size; each gets a fixed palette slot, overflow -> Other
  const commCount = d3.rollup(G.nodes.filter(n=>!n.is_bot), (v) => v.length, (n) => n.community);
  const ranked = [...commCount.entries()].sort((a, b) => b[1] - a[1]).map((d) => d[0]);
  communityLabels = new Map();
  const commColor = new Map();
  ranked.forEach((c, i) => {
    commColor.set(c, i < PALETTE.length ? PALETTE[i] : OTHER);
    // name the cluster after its most prolific human member
    const top = G.nodes
      .filter((n) => n.community === c && !n.is_bot)
      .sort((a, b) => b.commits - a.commits)[0];
    communityLabels.set(c, top ? top.name : `Community ${c}`);
  });

  orgList = [...d3.rollup(G.nodes, (v) => v.length, (n) => n.org).entries()]
    .sort((a, b) => b[1] - a[1])
    .map((d) => d[0]);
  const orgColor = new Map(orgList.map((o, i) => [o, i < PALETTE.length ? PALETTE[i] : OTHER]));

  colorScale = (n) =>
    state.colorBy === "community" ? commColor.get(n.community) || OTHER : orgColor.get(n.org) || OTHER;
}

/* ───────────────────────── svg / sim ───────────────────────── */
function setupSVG() {
  const svg = d3.select("#graph");
  const stage = el("stage").getBoundingClientRect();
  svg.attr("viewBox", [0, 0, stage.width, stage.height]);

  defs = svg.append("defs");
  zoomG = svg.append("g");
  gLink = zoomG.append("g").attr("class", "links");
  gNode = zoomG.append("g").attr("class", "nodes");

  zoomBehavior = d3
    .zoom()
    .scaleExtent([0.2, 6])
    .on("zoom", (e) => zoomG.attr("transform", e.transform));
  svg.call(zoomBehavior);

  sim = d3
    .forceSimulation()
    .alphaDecay(0.035)
    .velocityDecay(0.45)
    .force("charge", d3.forceManyBody().strength(-190).distanceMax(520))
    .force("link", d3.forceLink().id((d) => d.id).distance((l) => 70 / Math.sqrt(l.w || 1)).strength(0.35))
    .force("center", d3.forceCenter(stage.width / 2, stage.height / 2))
    .force("collide", d3.forceCollide().radius((d) => d.r + 4))
    .force("x", d3.forceX(stage.width / 2).strength(0.02))
    .force("y", d3.forceY(stage.height / 2).strength(0.02))
    .on("tick", ticked);

  window.addEventListener("resize", () => {
    const s = el("stage").getBoundingClientRect();
    svg.attr("viewBox", [0, 0, s.width, s.height]);
    sim.force("center", d3.forceCenter(s.width / 2, s.height / 2));
  });
}

/* commits accumulated by a node up to (and within window of) the current month */
function nodeCommits(n) {
  const m = state.month;
  const lo = state.mode === "window" ? Math.max(0, m - state.window + 1) : 0;
  let c = 0;
  for (let i = lo; i <= m; i++) c += n.monthly[i] || 0;
  return c;
}
function linkWeight(l) {
  const m = state.month;
  const lo = state.mode === "window" ? Math.max(0, m - state.window + 1) : 0;
  let w = 0;
  for (const [mo, inc] of Object.entries(l.monthly)) {
    const k = +mo;
    if (k >= lo && k <= m) w += inc;
  }
  return w;
}

/* which nodes/links exist at the current time + filters */
function visibleSet() {
  const showBots = state.showBots;
  const nodeC = new Map();
  const nodes = [];
  for (const n of G.nodes) {
    if (n.is_bot && !showBots) continue;
    const c = nodeCommits(n);
    if (c <= 0) continue;
    nodeC.set(n.id, c);
    nodes.push(n);
  }
  const vis = new Set(nodes.map((n) => n.id));
  const links = [];
  const degree = new Map();
  for (const l of G.links) {
    if (!vis.has(l.s) || !vis.has(l.t)) continue;
    const w = linkWeight(l);
    if (w < state.minWeight) continue;
    l.w = w;
    links.push(l);
    degree.set(l.s, (degree.get(l.s) || 0) + 1);
    degree.set(l.t, (degree.get(l.t) || 0) + 1);
  }
  // when filtering by tie strength, drop contributors left with no ties — a
  // co-authorship network shouldn't scatter isolated dots across the canvas
  const outNodes = state.minWeight > 1
    ? nodes.filter((n) => (degree.get(n.id) || 0) > 0)
    : nodes;
  return { nodes: outNodes, links, nodeC, degree };
}

function radiusScale(nodes, nodeC, degree) {
  const val = (n) =>
    state.sizeBy === "commits" ? nodeC.get(n.id) || 0
    : state.sizeBy === "degree" ? degree.get(n.id) || 0
    : n.betweenness;
  const max = d3.max(nodes, val) || 1;
  const s = d3.scaleSqrt().domain([0, max]).range([3, 24]);
  return (n) => s(val(n));
}

/* ───────────────────────── main update ───────────────────────── */
function update(reheat) {
  const prevIds = new Set(sim.nodes().map((n) => n.id));
  const { nodes, links, nodeC, degree } = visibleSet();
  const newCount = nodes.reduce((a, n) => a + (prevIds.has(n.id) ? 0 : 1), 0);
  const r = radiusScale(nodes, nodeC, degree);

  // place newly-appearing nodes near an already-placed neighbor
  const placed = new Set(nodes.filter((n) => n.x != null).map((n) => n.id));
  const center = el("stage").getBoundingClientRect();
  for (const l of links) {
    for (const [a, b] of [[l.s, l.t], [l.t, l.s]]) {
      const na = NBYID.get(a), nb = NBYID.get(b);
      if (na && na.x == null && nb && nb.x != null) {
        na.x = nb.x + (Math.random() - 0.5) * 40;
        na.y = nb.y + (Math.random() - 0.5) * 40;
      }
    }
  }
  nodes.forEach((n) => {
    if (n.x == null) { n.x = center.width / 2 + (Math.random() - 0.5) * 80; n.y = center.height / 2 + (Math.random() - 0.5) * 80; }
    n.r = r(n);
  });

  // ── data joins ──
  gLink.selectAll("line")
    .data(links, (l) => l.s + "|" + l.t)
    .join(
      (enter) => enter.append("line").attr("class", "link"),
      (u) => u,
      (exit) => exit.remove()
    )
    .attr("stroke-width", (l) => Math.min(4, 0.5 + Math.sqrt(l.w)));

  const nodeSel = gNode.selectAll("g.node")
    .data(nodes, (n) => n.id)
    .join(
      (enter) => {
        const g = enter.append("g").attr("class", "node");
        g.append("circle");
        g.call(drag(sim));
        g.on("mouseenter", (e, n) => hover(n))
          .on("mousemove", moveTip)
          .on("mouseleave", unhover)
          .on("click", (e, n) => { e.stopPropagation(); focusNode(n); });
        return g;
      },
      (u) => u,
      (exit) => exit.remove()
    );
  nodeSel.select("circle").attr("r", (n) => n.r)
    .attr("fill", (n) => (n.avatar ? avatarFill(n) : colorScale(n)))
    .attr("fill-opacity", (n) => (n.is_bot ? 0.5 : n.avatar ? 1 : 0.92))
    // avatar nodes wear their community/org color as a ring so identity still reads
    .attr("stroke", (n) => (n.avatar ? colorScale(n) : null))
    .attr("stroke-width", (n) => (n.avatar ? Math.max(1.6, n.r * 0.2) : null));

  d3.select("#graph").on("click", () => { state.selected = null; clearHighlight(); });

  sim.nodes(nodes);
  sim.force("link").links(links);
  // reheat in proportion to how much the visible set changed, so a big scrub
  // jump lets new nodes find their place while a single-month step stays calm
  const alpha = reheat ? 0.7 : Math.min(0.6, 0.08 + newCount / 35);
  sim.alpha(alpha).restart();

  drawLegend();
  updateMetrics(nodes, links, nodeC);
  if (state.selected && vis(nodes, state.selected)) applyHighlight(state.selected);
}

const vis = (nodes, id) => nodes.some((n) => n.id === id);

/* zoom/pan so the visible network fills the stage */
function fitView(dur = 600) {
  const nodes = sim.nodes().filter((n) => n.x != null);
  if (!nodes.length) return;
  // frame the dense core: a few isolated contributors shouldn't shrink everything
  const xs = nodes.map((n) => n.x).sort(d3.ascending);
  const ys = nodes.map((n) => n.y).sort(d3.ascending);
  const pad = 50;
  const x0 = d3.quantileSorted(xs, 0.02) - pad, x1 = d3.quantileSorted(xs, 0.98) + pad;
  const y0 = d3.quantileSorted(ys, 0.02) - pad, y1 = d3.quantileSorted(ys, 0.98) + pad;
  const s = el("stage").getBoundingClientRect();
  const k = Math.max(0.2, Math.min(2.2, Math.min(s.width / (x1 - x0), s.height / (y1 - y0))));
  const tx = (s.width - k * (x0 + x1)) / 2;
  const ty = (s.height - k * (y0 + y1)) / 2;
  d3.select("#graph").transition().duration(dur).call(
    zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(k)
  );
}

function ticked() {
  gLink.selectAll("line")
    .attr("x1", (l) => NBYID.get(l.s).x).attr("y1", (l) => NBYID.get(l.s).y)
    .attr("x2", (l) => NBYID.get(l.t).x).attr("y2", (l) => NBYID.get(l.t).y);
  gNode.selectAll("g.node").attr("transform", (n) => `translate(${n.x},${n.y})`);
}

/* ───────────────────────── interaction ───────────────────────── */
function drag(sim) {
  return d3.drag()
    .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.2).restart(); d.fx = d.x; d.fy = d.y; })
    .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
    .on("end", (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });
}

function hover(n) {
  const tip = el("tooltip");
  const deg = neighborsOf(n.id).size;
  const avatar = n.avatar
    ? `<img class="tt-avatar" src="${escapeHTML(n.avatar)}" alt="" style="border-color:${colorScale(n)}"/>`
    : "";
  tip.innerHTML =
    `<div class="tt-head">${avatar}<div>` +
    `<div class="tt-name">${escapeHTML(n.name)}${n.is_bot ? " <span class='tt-org'>· bot</span>" : ""}</div>` +
    `<div class="tt-org">${escapeHTML(n.org)} · “${escapeHTML(communityLabels.get(n.community) || "")}” cluster</div>` +
    `</div></div>` +
    `<div class="tt-stats"><span><b>${fmt(nodeCommits(n))}</b> commits</span><span><b>${deg}</b> ties</span></div>` +
    `<div class="tt-repos">${n.repos.map(escapeHTML).join(" · ")}</div>`;
  tip.hidden = false;
  if (!state.selected) applyHighlight(n.id);
}
function moveTip(e) {
  const tip = el("tooltip");
  const s = el("stage").getBoundingClientRect();
  let x = e.clientX - s.left + 14, y = e.clientY - s.top + 14;
  if (x + 240 > s.width) x -= 260;
  if (y + tip.offsetHeight > s.height) y -= tip.offsetHeight + 24;
  tip.style.left = x + "px"; tip.style.top = y + "px";
}
function unhover() {
  el("tooltip").hidden = true;
  if (!state.selected) clearHighlight();
}
function focusNode(n) {
  state.selected = state.selected === n.id ? null : n.id;
  state.selected ? applyHighlight(n.id) : clearHighlight();
}

function neighborWeights(id) {
  const w = new Map();
  for (const l of sim.force("link").links()) {
    if (l.s === id) w.set(l.t, l.w);
    else if (l.t === id) w.set(l.s, l.w);
  }
  return w;
}
function neighborsOf(id) {
  return new Set(neighborWeights(id).keys());
}
function applyHighlight(id) {
  const w = neighborWeights(id);
  const keep = new Set(w.keys()); keep.add(id);
  gNode.selectAll("g.node").classed("faded", (n) => !keep.has(n.id)).classed("highlight", (n) => n.id === id);
  gLink.selectAll("line").classed("faded", (l) => l.s !== id && l.t !== id);
  // label only the focus node and its strongest ties, or the wall of names is unreadable
  const top = [...w.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map((d) => d[0]);
  const labels = new Set(top); labels.add(id);
  showLabels(labels);
}
function clearHighlight() {
  gNode.selectAll("g.node").classed("faded", false).classed("highlight", false);
  gLink.selectAll("line").classed("faded", false);
  showLabels(null);
}
function showLabels(ids) {
  gNode.selectAll("text.node-label").remove();
  if (!ids) return;
  gNode.selectAll("g.node").filter((n) => ids.has(n.id))
    .append("text").attr("class", "node-label").attr("x", (n) => n.r + 3).attr("y", 3)
    .text((n) => n.name);
}

/* ───────────────────────── legend + metrics ───────────────────────── */
function drawLegend() {
  const box = d3.select("#legend");
  let rows;
  if (state.colorBy === "community") {
    const counts = d3.rollup(G.nodes.filter(n=>!n.is_bot), (v) => v.length, (n) => n.community);
    rows = [...communityLabels.entries()]
      .map(([c, label]) => ({ key: c, label, n: counts.get(c) || 0, color: colorScale({ community: c, org: "" }) }))
      .filter((d) => d.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 8);
  } else {
    const counts = d3.rollup(G.nodes, (v) => v.length, (n) => n.org);
    rows = orgList.map((o) => ({ key: o, label: o, n: counts.get(o) || 0, color: colorScale({ org: o, community: -99 }) }));
  }
  const sel = box.selectAll(".row").data(rows, (d) => d.key);
  const en = sel.enter().append("div").attr("class", "row");
  en.append("span").attr("class", "swatch");
  en.append("div").attr("class", "lbl");
  en.append("b");
  const all = en.merge(sel);
  all.select(".swatch").style("background", (d) => d.color);
  all.select(".lbl").text((d) => d.label);
  all.select("b").text((d) => d.n);
  sel.exit().remove();
}

function updateMetrics(nodes, links, nodeC) {
  const humans = nodes.filter((n) => !n.is_bot);
  // true distinct commits in the active time range (not person-weighted)
  const cm = G.meta.commits_monthly;
  const lo = state.mode === "window" ? Math.max(0, state.month - state.window + 1) : 0;
  let commits = 0;
  for (let i = lo; i <= state.month; i++) commits += cm[i] || 0;
  const N = nodes.length, E = links.length;
  const density = N > 1 ? (2 * E) / (N * (N - 1)) : 0;
  el("metric-month").textContent = prettyMonth(state.month);
  el("m-nodes").textContent = fmt(humans.length);
  el("m-edges").textContent = fmt(E);
  el("m-commits").textContent = fmt(commits);
  el("m-density").textContent = density.toFixed(3);
  el("tl-month").innerHTML = prettyMonth(state.month).replace(/·\s(.+)$/, "· <b>$1</b>");
  drawGrowth();
}

function prettyMonth(m) {
  const [y, mo] = MONTHS[m].split("-");
  const name = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+mo - 1];
  return `${y} · ${name}`;
}

/* ───────────────────────── growth sparkline ───────────────────────── */
function drawGrowth() {
  const svg = d3.select("#growth");
  svg.selectAll("*").remove();
  const W = 240, H = 44;
  const series = G.timeline.map((t) => t.nodes);
  const x = d3.scaleLinear().domain([0, series.length - 1]).range([0, W]);
  const y = d3.scaleLinear().domain([0, d3.max(series)]).range([H - 3, 3]);
  const area = d3.area().x((d, i) => x(i)).y0(H).y1((d) => y(d)).curve(d3.curveMonotoneX);
  const line = d3.line().x((d, i) => x(i)).y((d) => y(d)).curve(d3.curveMonotoneX);
  svg.append("path").attr("d", area(series)).attr("fill", GOLD).attr("fill-opacity", 0.12);
  svg.append("path").attr("d", line(series)).attr("fill", "none").attr("stroke", GOLD).attr("stroke-width", 1.5);
  svg.append("circle").attr("cx", x(state.month)).attr("cy", y(series[state.month])).attr("r", 3).attr("fill", GOLD);
  svg.append("line").attr("x1", x(state.month)).attr("x2", x(state.month)).attr("y1", 0).attr("y2", H)
    .attr("stroke", GOLD).attr("stroke-opacity", 0.3).attr("stroke-dasharray", "2 2");
}

/* ───────────────────────── timeline ───────────────────────── */
function setupTimeline() {
  const scrub = el("scrub");
  scrub.max = MONTHS.length - 1;
  scrub.value = state.month;
  scrub.addEventListener("input", () => { stopPlay(); state.month = +scrub.value; update(false); });

  // activity histogram behind the scrubber
  const track = d3.select("#tl-track");
  const w = document.querySelector(".tl-track-wrap").getBoundingClientRect().width;
  track.attr("viewBox", [0, 0, w, 26]);
  const perMonth = MONTHS.map((_, i) => d3.sum(G.nodes, (n) => n.monthly[i] || 0));
  const x = d3.scaleLinear().domain([0, MONTHS.length - 1]).range([0, w]);
  const h = d3.scaleSqrt().domain([0, d3.max(perMonth)]).range([0, 24]);
  track.selectAll("rect").data(perMonth).join("rect")
    .attr("x", (d, i) => x(i)).attr("width", w / MONTHS.length + 0.5)
    .attr("y", (d) => 26 - h(d)).attr("height", (d) => h(d))
    .attr("fill", "#3a3a34");

  // milestone annotations
  const ann = d3.select("#tl-annotations");
  MILESTONES.forEach(([ym, label]) => {
    const idx = MONTHS.indexOf(ym);
    if (idx < 0) return;
    ann.append("div").attr("class", "ann")
      .style("left", (idx / (MONTHS.length - 1)) * 100 + "%")
      .attr("data-label", label)
      .on("click", () => { stopPlay(); state.month = idx; el("scrub").value = idx; update(false); });
  });

  el("play").addEventListener("click", togglePlay);
}

function togglePlay() { state.playing ? stopPlay() : startPlay(); }
function startPlay() {
  state.playing = true;
  el("play").textContent = "❚❚"; el("play").classList.add("playing");
  el("hint").style.opacity = 0;
  if (state.month >= MONTHS.length - 1) { state.month = 0; resetPositions(); }
  playTimer = setInterval(() => {
    if (state.month >= MONTHS.length - 1) { stopPlay(); fitView(900); return; }
    state.month++;
    el("scrub").value = state.month;
    update(false);
    if (state.month % 12 === 0) fitView(700); // keep the growing network framed
  }, 380);
}
function stopPlay() {
  state.playing = false;
  el("play").textContent = "▶"; el("play").classList.remove("playing");
  if (playTimer) clearInterval(playTimer);
}
function resetPositions() {
  // let the network re-grow from a clean slate
  G.nodes.forEach((n) => { n.x = null; n.y = null; });
}

/* ───────────────────────── controls ───────────────────────── */
function setupControls() {
  segmented("color-by", (v) => { state.colorBy = v; setupColorDomains(); update(false); });
  segmented("mode", (v) => {
    state.mode = v; el("win-ctl").hidden = v !== "window"; update(false);
  });
  el("size-by").addEventListener("change", (e) => { state.sizeBy = e.target.value; update(false); });
  el("minw").addEventListener("input", (e) => { state.minWeight = +e.target.value; el("minw-val").textContent = e.target.value; update(false); });
  el("win").addEventListener("input", (e) => { state.window = +e.target.value; el("win-val").textContent = e.target.value; update(false); });
  el("show-bots").addEventListener("change", (e) => { state.showBots = e.target.checked; update(false); });

  const search = el("search");
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    const box = el("search-results");
    box.innerHTML = "";
    if (!q) return;
    G.nodes.filter((n) => n.name.toLowerCase().includes(q)).slice(0, 6).forEach((n) => {
      const d = document.createElement("div");
      d.className = "hit";
      d.innerHTML = `<span style="color:${colorScale(n)}">●</span> ${escapeHTML(n.name)} <span>${fmt(n.commits)}</span>`;
      d.onclick = () => selectAndZoom(n);
      box.appendChild(d);
    });
  });
}
/* deep-linkable state: ?color=org&size=degree&w=5&bots=1&mode=window&win=12&t=54 */
function applyURLState() {
  const p = new URLSearchParams(location.search);
  const setSeg = (id, val) => el(id).querySelectorAll("button")
    .forEach((b) => b.classList.toggle("on", b.dataset.val === val));
  if (p.has("color")) { state.colorBy = p.get("color"); setSeg("color-by", state.colorBy); }
  if (p.has("size")) { state.sizeBy = p.get("size"); el("size-by").value = state.sizeBy; }
  if (p.has("w")) { state.minWeight = +p.get("w"); el("minw").value = state.minWeight; el("minw-val").textContent = state.minWeight; }
  if (p.has("bots")) { state.showBots = p.get("bots") === "1"; el("show-bots").checked = state.showBots; }
  if (p.has("mode")) { state.mode = p.get("mode"); setSeg("mode", state.mode); el("win-ctl").hidden = state.mode !== "window"; }
  if (p.has("win")) { state.window = +p.get("win"); el("win").value = state.window; el("win-val").textContent = state.window; }
  if (p.has("t")) { state.month = Math.max(0, Math.min(MONTHS.length - 1, +p.get("t"))); el("scrub").value = state.month; }
  setupColorDomains();
}

function segmented(id, cb) {
  const wrap = el(id);
  wrap.querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      wrap.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      cb(b.dataset.val);
    });
  });
}
function selectAndZoom(n) {
  // make sure the node is visible in time
  if (nodeCommits(n) <= 0) { state.month = MONTHS.length - 1; el("scrub").value = state.month; update(false); }
  state.selected = n.id; applyHighlight(n.id);
  const svg = d3.select("#graph");
  const s = el("stage").getBoundingClientRect();
  svg.transition().duration(700).call(
    zoomBehavior.transform,
    d3.zoomIdentity.translate(s.width / 2, s.height / 2).scale(1.6).translate(-n.x, -n.y)
  );
}

/* ───────────────────────── util ───────────────────────── */
function escapeHTML(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
