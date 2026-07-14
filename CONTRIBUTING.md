# How to contribute

I'm really glad you're reading this, because we love all the brave developers who can support and strengthen an important project like Zcash.

Here are some important resources:

  * [Zcash official website](https://z.cash)
  * [Zcash community forum](https://forum.zcashcommunity.com)
  * [ZecHub wiki](https://zechub.wiki)
  * [CodeZ archive](https://codez.ombie.cash)

## The final goal

To give a gift to the heroic Zcash developers and celebrate ten years of commits.

## The contest

A prize of 1 $ZEC for the best project of data storytelling and visualization.

One deliverable: the **dynamic co-authorship network** (projection of bipartite network of authors and repositories) of Zcash ecosystem with animated and interactive visualizations.

Required features:
- incremental updates,
- custom time slicing,
- authors deduplication (sort of),
- web-based interactive viz.

Extra features:
- multi-processes support,
- network analysis and metrics.

Recommended tech stack:
- Docker
- Python
- [PyDriller](https://pydriller.readthedocs.io/en/latest/)
- [NetworkX-Temporal](https://networkx-temporal.readthedocs.io/en/stable/)
- [PathpyG](https://www.pathpy.net/0.2.0-dev/)

I need to be able to review proposed code, not just run it, so no binaries or spaghetti. At the end, I'll run your projects on my local server (where all up-to-date repositories live), so no malicious code.

> IMPORTANT! The awarding of the prize will be at my sole discretion and may not take place at all if I deem the quality of the proposals insufficient.

LLM, coding agents, vibe coding, all AI-related tools are welcome! But you remain solely responsible for the proposed code.

## Deadline

The Ironwood activation on mainnet (block 3,428,143): around July 28th at 1pm UTC.

## Starting data

All Zcash core code repositories from official mantainers and an opinionated selection of best repos from the broader community. You can find them on https://codez.ombie.cash (GitHub mirror). Locally I have a folder on disk with all bare repositories: `data/<orgs>/<repos.git>` (bare repos, no staging area).

You can reproduce it cloning a bunch of repositories in the `data` folder, ie. `git clone --bare https://github.com/ZcashFoundation/zebra.git data/ZcashFoundation/zebra.git`. You can use the provided `init.sh` script.

## Submitting a project

Put your code in a `projects/<your github name>/` folder. You can read the `data/` folder from there.
Put your Unified Address in a `projects/<your github name>/ua.txt` file.
A good README.md file is always appreciated. Add also a custom LICENSE file if needed.

Please send a [GitHub Pull Request](https://github.com/jenkin/zcash-irondevs/pull/new/main) with a clear list of what you've done and how to run your code (screenshots are appreciated). Always write a clear log message for your commits following [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) spec.

Thanks, and good luck!

