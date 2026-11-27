#!/usr/bin/env bash
set -euo pipefail

# Usage: ./docker-push.sh <version>
# Builds and pushes bernardogiordano/rewind:<version> and :latest.

IMAGE="bernardogiordano/rewind"
VERSION="${1:-}"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage: $0 <version>   (e.g. $0 1.1.0)" >&2
  exit 1
fi

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t "$IMAGE:$VERSION" \
  -t "$IMAGE:latest" \
  --push .
