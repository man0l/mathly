#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_JSON="${APP_JSON_FILE:-$ROOT_DIR/app.json}"
BUILD_NUMBER="${IOS_BUILD_NUMBER:?IOS_BUILD_NUMBER is required}"

if [[ ! -f "$APP_JSON" ]]; then
  echo "error: $APP_JSON not found" >&2
  exit 1
fi

export APP_JSON BUILD_NUMBER
python3 <<'PY'
import json
import os
import pathlib

app_json_path = pathlib.Path(os.environ["APP_JSON"])
build_number = os.environ["BUILD_NUMBER"]

data = json.loads(app_json_path.read_text())
data["expo"].setdefault("ios", {})["buildNumber"] = str(build_number)
app_json_path.write_text(json.dumps(data, indent=2) + "\n")
print(f"set expo.ios.buildNumber to {build_number}")
PY
