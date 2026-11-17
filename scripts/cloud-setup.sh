#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --version
node --check game.js
node --check sw.js
node --check serve.cjs
node -e 'JSON.parse(require("node:fs").readFileSync("manifest.webmanifest", "utf8")); console.log("Manifest OK")'
echo 'Setup complete. No packages, database or secrets required. Start: node serve.cjs'
