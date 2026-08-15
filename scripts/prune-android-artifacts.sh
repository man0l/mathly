#!/usr/bin/env bash
set -euo pipefail

KEEP="${KEEP_ARTIFACTS:-2}"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

export KEEP REPO
python3 <<'PY'
import json
import os
import subprocess
import urllib.parse

keep = int(os.environ["KEEP"])
repo = os.environ["REPO"]
gh = ["gh", "api", "-H", "Accept: application/vnd.github+json"]


def run(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, text=True)


def delete_release(tag: str) -> None:
    print(f"Deleting release {tag}")
    subprocess.run(
        ["gh", "release", "delete", tag, "--repo", repo, "--yes", "--cleanup-tag"],
        check=True,
    )


def delete_artifact(artifact_id: int, name: str) -> None:
    print(f"Deleting workflow artifact {name} ({artifact_id})")
    subprocess.run(
        gh + ["-X", "DELETE", f"repos/{repo}/actions/artifacts/{artifact_id}"],
        check=True,
    )


releases_raw = run(["gh", "release", "list", "--repo", repo, "--limit", "200", "--json", "tagName,createdAt"])
releases = [r for r in json.loads(releases_raw) if r["tagName"].startswith("android-")]
releases.sort(key=lambda r: r["createdAt"], reverse=True)
for release in releases[keep:]:
    delete_release(release["tagName"])

page = 1
artifacts: list[dict] = []
while True:
    query = urllib.parse.urlencode({"per_page": 100, "page": page})
    batch = json.loads(run(gh + [f"repos/{repo}/actions/artifacts?{query}"]))
    if not batch.get("artifacts"):
        break
    artifacts.extend(
        a for a in batch["artifacts"] if a["name"].startswith("looxmaxxing-play-") and not a["expired"]
    )
    if len(batch["artifacts"]) < 100:
        break
    page += 1

artifacts.sort(key=lambda a: a["created_at"], reverse=True)
for artifact in artifacts[keep:]:
    delete_artifact(artifact["id"], artifact["name"])

print(f"Pruned to max {keep} android releases and workflow artifacts")
PY