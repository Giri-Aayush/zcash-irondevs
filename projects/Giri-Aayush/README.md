# Ten Years of Zcash — Dynamic Co-Authorship Network

> An animated, time-sliceable map of everyone who built Zcash and who they built it with — a decade of commits assembled into a living network, in the browser.

![The Zcash co-authorship network](docs/hero.png)

Every dot is a **person**. Every line joins two people who committed inside the
same repository. Press **play** and a decade of collaboration assembles itself
month by month — from the six-person founding team in 2016 to the ~180-strong
ecosystem that ships Ironwood. Contributor nodes carry their real GitHub avatars,
ringed in their detected community color.

This is the [Irondevs contest](https://github.com/jenkin/zcash-irondevs)
deliverable: the *dynamic co-authorship network* (the projection of the
bipartite author↔repository graph), with animated, interactive visualization.

---

## Architecture

Two decoupled halves, exactly as the contest describes ("decouple raw data
access from computation"):

```
pipeline/     Python · reads bare repos → emits web-next/public/graph.json
  mine.py       PyDriller metadata mining · multiprocessing · incremental cache
  identity.py   author deduplication (union-find) + bot detection
  avatars.py    GitHub avatar resolution via `gh` (downloaded locally, cached)
  graph.py      bipartite→author projection · temporal weights · communities · metrics
  cli.py        mine → build → graph.json  (top-N cap keeps it bounded on the full archive)

web-next/     Next.js 16 + Tailwind v4 + shadcn · reads graph.json, renders the viz
  src/components/GraphCanvas.tsx   D3 force graph (play, zoom, filter, search, hover)
  src/components/{StatsBar,ControlPanel,Timeline,Tooltip}.tsx
  src/lib/{graph,store}.ts         data model + zustand state
```

The front-end is a **static export** — `next build` emits plain files in `out/`,
so the judge serves it with any static server; no Node runtime needed to view.

## Quick start

```bash
# 1. from the contest repo root — clone the repositories once
./init.sh

# 2. generate the data (from this folder)
uv sync
uv run ironwood --avatars --out web-next/public/graph.json   # ~6s on the seed repos

# 3. build + serve the visualization
cd web-next
npm ci
npm run build
npx serve out            # open the printed URL
```

`web-next/public/graph.json` and the avatars are **committed**, so you can skip
step 2 and go straight to `npm ci && npm run build` to see it with the seed data.
Re-running the pipeline against the full CodeZ archive just regenerates that file.

### Docker

```bash
docker build -t zcash-irondevs .          # builds the static site
docker run --rm -p 3000:3000 zcash-irondevs
```

---

## Contest requirements → where they live

| Required feature | How it's implemented |
|---|---|
| **Bipartite → author projection** | `pipeline/graph.py` — authors↔repos projected to co-contribution edges; `Co-authored-by` trailers add weight |
| **Incremental updates** | `pipeline/mine.py` — per-repo cache keyed by `HEAD`; unchanged repos skipped, changed repos append only unseen commits |
| **Custom time slicing** | monthly-bucketed model; **Cumulative** and sliding **Window** modes, any month |
| **Author deduplication** | `pipeline/identity.py` — union-find over name/email aliases, GitHub `noreply` normalization, bot tagging |
| **Web-based interactive viz** | `web-next/` — D3 force graph, animation, search, filters, tooltips |
| *Extra:* **multi-process** | `pipeline/mine.py` — one worker process per repository |
| *Extra:* **network metrics** | degree, betweenness, Louvain communities + a per-month density/size timeline |

## Scaling to the full archive

The judge runs this on 500+ repos / millions of commits / thousands of
contributors. Mining is metadata-only + parallel; the network is then **capped to
the top-N contributors by commits** (`--max-nodes`, default 500) *before*
projecting, so the edge set and `graph.json` stay bounded and the force layout
stays legible at any archive size. Headline metrics (commits, growth) are computed
on the full data; the rendered network is the most prolific people.

## How the network is built

Two contributors are linked when they have both committed to a shared
repository; the edge is born the month the later of the two first touches it, and
gains weight per shared repo. Committing the **same commit** (a `Co-authored-by`
trailer) is a stronger signal, so those ties add extra, month-stamped weight —
making `weight == Σ monthly increments`, so the tie-strength filter is consistent
through time. Identities are union-found over `(name, email)` so the graph
reflects people, not addresses.

## Notes

- Design language crafted in Claude Design, implemented here in Next.js + shadcn.
- D3 is the only heavyweight runtime dep; the pipeline stays small and reviewable.

## License

See [LICENSE.md](LICENSE.md) (MIT). D3.js is under the ISC license.
