#!/usr/bin/env sh
set -eu

VOICES_DIR="${1:-/voices}"
BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main/sv/sv_SE/alma/medium"

mkdir -p "$VOICES_DIR"

curl -fsSL "$BASE/sv_SE-alma-medium.onnx" -o "$VOICES_DIR/sv_SE-alma-medium.onnx"
curl -fsSL "$BASE/sv_SE-alma-medium.onnx.json" -o "$VOICES_DIR/sv_SE-alma-medium.onnx.json"

echo "Downloaded Alma voice to $VOICES_DIR"
