#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GRADLE_FILE="${ANDROID_DIR:-$ROOT_DIR/android}/app/build.gradle"
RAW_CODE="${ANDROID_VERSION_CODE:?ANDROID_VERSION_CODE is required}"
if (( RAW_CODE < 3 )); then
  VERSION_CODE=3
else
  VERSION_CODE=$RAW_CODE
fi

if [[ ! -f "$GRADLE_FILE" ]]; then
  echo "error: $GRADLE_FILE not found — run expo prebuild first" >&2
  exit 1
fi

export GRADLE_FILE VERSION_CODE
python3 <<'PY'
import os
import pathlib
import re

gradle_path = pathlib.Path(os.environ["GRADLE_FILE"])
version_code = os.environ["VERSION_CODE"]
content = gradle_path.read_text()

updated, count = re.subn(
    r"versionCode\s+\d+",
    f"versionCode {version_code}",
    content,
    count=1,
)
if count != 1:
    raise SystemExit("error: could not patch versionCode in build.gradle")

gradle_path.write_text(updated)
print(f"set versionCode to {version_code}")
PY