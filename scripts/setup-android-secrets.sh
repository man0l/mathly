#!/usr/bin/env bash
# Creates (if needed) the Play upload keystore and pushes every credential the
# Android Release workflow needs into GitHub Actions secrets, via `gh`.
#
# Secrets never touch the terminal scrollback: passwords are read with `read -s`
# and every value is piped to `gh secret set --body-file -`. The generated
# keystore is written to the path you choose (default ./upload-keystore.p12) —
# back it up, Play will only ever accept uploads signed with this key.
#
#   bash scripts/setup-android-secrets.sh
#   KEYSTORE_FILE=~/keys/mathly.p12 bash scripts/setup-android-secrets.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYSTORE_FILE="${KEYSTORE_FILE:-$ROOT_DIR/upload-keystore.p12}"
PACKAGE_NAME="${ANDROID_PACKAGE_NAME:-com.balkanbit.mathly}"

command -v gh >/dev/null || {
  echo "error: GitHub CLI (gh) is required — 'brew install gh', or https://cli.github.com" >&2
  exit 1
}

# keytool comes with any JDK; on macOS it is also bundled inside Android Studio.
if ! command -v keytool >/dev/null; then
  for candidate in \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool" \
    "$HOME/Library/Java/JavaVirtualMachines"/*/Contents/Home/bin/keytool; do
    if [[ -x "$candidate" ]]; then
      PATH="$(dirname "$candidate"):$PATH"
      break
    fi
  done
fi
command -v keytool >/dev/null || {
  echo "error: keytool not found — 'brew install --cask temurin@17', or install any JDK 17" >&2
  exit 1
}

gh auth status >/dev/null 2>&1 || { echo "error: run 'gh auth login' first" >&2; exit 1; }

REPO="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
echo "Target repository: $REPO"

set_secret() {
  local name="$1" value="$2"
  if [[ -z "$value" ]]; then
    echo "  skipped $name (empty input — existing value, if any, is left alone)"
    return
  fi
  printf '%s' "$value" | gh secret set "$name" --repo "$REPO" --body-file -
  echo "  set     $name"
}

prompt_secret() {           # prompt_secret VAR_NAME "question"
  local __var="$1" __prompt="$2" __value
  read -r -s -p "$__prompt: " __value </dev/tty
  echo
  printf -v "$__var" '%s' "$__value"
}

b64() { base64 -w0 "$1" 2>/dev/null || base64 "$1" | tr -d '\n'; }

# --- 1. keystore -------------------------------------------------------------
if [[ -f "$KEYSTORE_FILE" ]]; then
  echo
  echo "Using existing keystore: $KEYSTORE_FILE"
  read -r -p "Key alias in that keystore [upload]: " KEY_ALIAS </dev/tty
  KEY_ALIAS="${KEY_ALIAS:-upload}"
  prompt_secret KEYSTORE_PASSWORD "Keystore password"
  prompt_secret KEY_PASSWORD "Key password (Enter to reuse the keystore password)"
  KEY_PASSWORD="${KEY_PASSWORD:-$KEYSTORE_PASSWORD}"
else
  echo
  echo "No keystore at $KEYSTORE_FILE — generating a new PKCS#12 upload key."
  echo "Back this file up: Play only accepts uploads signed with it."
  read -r -p "Key alias [upload]: " KEY_ALIAS </dev/tty
  KEY_ALIAS="${KEY_ALIAS:-upload}"
  prompt_secret KEYSTORE_PASSWORD "New keystore password (min 6 chars)"
  KEY_PASSWORD="$KEYSTORE_PASSWORD"
  keytool -genkeypair -v \
    -keystore "$KEYSTORE_FILE" -storetype PKCS12 \
    -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KEYSTORE_PASSWORD" -keypass "$KEY_PASSWORD" \
    -dname "CN=$PACKAGE_NAME, OU=Mathly, O=BalkanBit, C=BG"
  echo "Created $KEYSTORE_FILE"
fi

keytool -list -keystore "$KEYSTORE_FILE" -storepass "$KEYSTORE_PASSWORD" -alias "$KEY_ALIAS" >/dev/null \
  || { echo "error: password/alias do not open $KEYSTORE_FILE" >&2; exit 1; }

# --- 2. Play service account -------------------------------------------------
echo
read -r -p "Path to the Play Console service-account JSON (Enter to skip): " SA_PATH </dev/tty
SA_JSON=""
if [[ -n "$SA_PATH" ]]; then
  SA_PATH="${SA_PATH/#\~/$HOME}"
  [[ -f "$SA_PATH" ]] || { echo "error: $SA_PATH not found" >&2; exit 1; }
  if command -v python3 >/dev/null; then
    python3 -c 'import json,sys; sa=json.load(open(sys.argv[1])); assert sa["type"]=="service_account"; assert sa["client_email"] and sa["private_key"]' "$SA_PATH" \
      || { echo "error: $SA_PATH is not a service-account key file" >&2; exit 1; }
  else
    echo "note: python3 not found — skipping the JSON sanity check (CI re-checks it)"
  fi
  SA_JSON="$(cat "$SA_PATH")"
fi

# --- 3. app runtime config ---------------------------------------------------
echo
read -r -p "EXPO_PUBLIC_API_BASE_URL (Enter to skip): " API_BASE_URL </dev/tty
read -r -p "EXPO_PUBLIC_REVENUECAT_KEY, goog_... (Enter to skip): " REVENUECAT_KEY </dev/tty

# --- 4. upload ---------------------------------------------------------------
echo
echo "Setting secrets on $REPO"
set_secret ANDROID_KEYSTORE_BASE64 "$(b64 "$KEYSTORE_FILE")"
set_secret ANDROID_KEYSTORE_PASSWORD "$KEYSTORE_PASSWORD"
set_secret ANDROID_KEY_ALIAS "$KEY_ALIAS"
set_secret ANDROID_KEY_PASSWORD "$KEY_PASSWORD"
set_secret GOOGLE_PLAY_SERVICE_ACCOUNT_JSON "$SA_JSON"
set_secret EXPO_PUBLIC_API_BASE_URL "$API_BASE_URL"
set_secret EXPO_PUBLIC_REVENUECAT_KEY "$REVENUECAT_KEY"

echo
echo "Done. Upload-key certificate fingerprints (give these to Play if asked):"
keytool -list -v -keystore "$KEYSTORE_FILE" -storepass "$KEYSTORE_PASSWORD" -alias "$KEY_ALIAS" \
  | grep -E 'SHA1:|SHA256:' || true
echo
echo "Next: gh workflow run android-release.yml --repo $REPO"
