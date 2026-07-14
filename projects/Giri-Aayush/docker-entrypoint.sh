#!/bin/sh
# Mine the mounted repositories, then serve the visualization.
set -e

DATA_DIR="${DATA_DIR:-/data}"
PORT="${PORT:-8080}"

echo "▸ mining $DATA_DIR"
python -m pipeline.cli --data "$DATA_DIR" --out web/graph.json

echo "▸ serving on :$PORT  (open http://localhost:$PORT)"
exec python -m http.server "$PORT" --directory web
