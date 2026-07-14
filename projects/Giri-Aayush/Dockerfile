# Zcash Irondevs — dynamic co-authorship network.
# Mines the bare repos mounted at /data, builds web/graph.json, serves the viz.
#
#   docker build -t zcash-irondevs .
#   docker run --rm -p 8080:8080 -v "$(pwd)/../../data:/data:ro" zcash-irondevs
#
FROM python:3.12-slim

WORKDIR /app

# git is required by PyDriller / GitPython to read the repositories
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    "pydriller>=2.10" "networkx>=3.3" "python-louvain>=0.16"

COPY pipeline ./pipeline
COPY web ./web
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["./docker-entrypoint.sh"]
