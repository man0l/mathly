#!/usr/bin/env bash
# Creates (if needed) the Play upload keystore and pushes every credential the
# Android Release workflow needs into GitHub Actions secrets, via `gh`.
#
# Secrets never touch the terminal scrollback: passwords are read with `read -s`
# and every value is piped into `gh secret set` on stdin. The generated
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

# A keystore is just a PKCS#12 file, so either keytool or openssl can build one.
# openssl is preinstalled on macOS and every Linux runner, so it is the default
# and nothing has to be installed to get an upload key.
#
# keytool is only used when openssl is absent, and it is probed rather than
# merely located: macOS ships a /usr/bin/keytool STUB that exists on PATH with
# no JDK behind it and dies with "Unable to locate a Java Runtime", so
# `command -v keytool` is not evidence that keytool works.
keytool_usable() {
  command -v "$1" >/dev/null 2>&1 && "$1" -help >/dev/null 2>&1
}

find_working_keytool() {
  local candidate
  if keytool_usable keytool; then
    echo keytool
    return 0
  fi
  for candidate in \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool" \
    "$HOME/Library/Java/JavaVirtualMachines"/*/Contents/Home/bin/keytool \
    "$JAVA_HOME/bin/keytool"; do
    if [[ -x "$candidate" ]] && keytool_usable "$candidate"; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

JAVA_HOME="${JAVA_HOME:-}"
if command -v openssl >/dev/null 2>&1; then
  KEYSTORE_TOOL=openssl
elif KEYTOOL_BIN="$(find_working_keytool)"; then
  KEYSTORE_TOOL=keytool
else
  echo "error: need openssl (preinstalled on macOS) or a working keytool" >&2
  exit 1
fi
echo "Keystore tool: $KEYSTORE_TOOL"

generate_keystore() {       # file alias password
  if [[ "$KEYSTORE_TOOL" == keytool ]]; then
    "$KEYTOOL_BIN" -genkeypair -v \
      -keystore "$1" -storetype PKCS12 \
      -alias "$2" -keyalg RSA -keysize 2048 -validity 10000 \
      -storepass "$3" -keypass "$3" \
      -dname "CN=$PACKAGE_NAME, OU=Mathly, O=BalkanBit, C=BG"
    return
  fi
  local key cert
  key="$(mktemp)"; cert="$(mktemp)"
  openssl req -x509 -newkey rsa:2048 -sha256 -days 10000 -nodes \
    -keyout "$key" -out "$cert" \
    -subj "/CN=$PACKAGE_NAME/OU=Mathly/O=BalkanBit/C=BG" 2>/dev/null
  # Prefer modern PBE; LibreSSL builds that reject these flags fall back to
  # their defaults, which Java still reads.
  openssl pkcs12 -export -inkey "$key" -in "$cert" -name "$2" -out "$1" \
    -passout pass:"$3" -keypbe AES-256-CBC -certpbe AES-256-CBC -macalg sha256 2>/dev/null \
    || openssl pkcs12 -export -inkey "$key" -in "$cert" -name "$2" -out "$1" \
         -passout pass:"$3"
  rm -f "$key" "$cert"
}

verify_keystore() {         # file alias password
  if [[ "$KEYSTORE_TOOL" == keytool ]]; then
    "$KEYTOOL_BIN" -list -keystore "$1" -storetype PKCS12 -storepass "$3" -alias "$2" >/dev/null 2>&1
  else
    openssl pkcs12 -in "$1" -nokeys -passin pass:"$3" >/dev/null 2>&1
  fi
}

print_fingerprints() {      # file alias password
  if [[ "$KEYSTORE_TOOL" == keytool ]]; then
    "$KEYTOOL_BIN" -list -v -keystore "$1" -storetype PKCS12 -storepass "$3" -alias "$2" \
      | grep -E 'SHA1:|SHA256:' || true
    return
  fi
  local cert
  cert="$(mktemp)"
  openssl pkcs12 -in "$1" -nokeys -passin pass:"$3" > "$cert" 2>/dev/null
  openssl x509 -in "$cert" -noout -fingerprint -sha1
  openssl x509 -in "$cert" -noout -fingerprint -sha256
  rm -f "$cert"
}

gh auth status >/dev/null 2>&1 || { echo "error: run 'gh auth login' first" >&2; exit 1; }

REPO="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
echo "Target repository: $REPO"

# Prove we can actually reach the Actions secrets API before prompting for
# anything — writing secrets needs admin rights on the repo, and finding that
# out after the prompts means retyping every value.
if ! gh secret list --repo "$REPO" >/dev/null 2>&1; then
  echo "error: cannot read Actions secrets for $REPO." >&2
  echo "       Setting secrets needs admin rights on the repo. Try:" >&2
  echo "         gh auth refresh -h github.com -s repo" >&2
  exit 1
fi

ALREADY_SET="$(gh secret list --repo "$REPO" 2>/dev/null | awk '{print $1}' | tr '\n' ' ')"
[[ -n "${ALREADY_SET// /}" ]] && echo "Already set: $ALREADY_SET"
echo "(Press Enter at any prompt to leave that secret as it is.)"

set_secret() {
  local name="$1" value="$2"
  if [[ -z "$value" ]]; then
    echo "  skipped $name (empty input — existing value, if any, is left alone)"
    return
  fi
  # gh reads the value from stdin when --body is omitted. Piping (rather than
  # --body "$value") also keeps the secret out of the process command line,
  # where `ps` would expose it to any other user on the machine.
  printf '%s' "$value" | gh secret set "$name" --repo "$REPO"
  echo "  set     $name"
}

prompt_secret() {           # prompt_secret VAR_NAME "question"
  local __var="$1" __prompt="$2" __value
  read -r -s -p "$__prompt: " __value </dev/tty
  echo
  printf -v "$__var" '%s' "$__value"
}

b64() { base64 -w0 < "$1" 2>/dev/null || base64 < "$1" | tr -d '\n'; }

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
  generate_keystore "$KEYSTORE_FILE" "$KEY_ALIAS" "$KEYSTORE_PASSWORD"
  echo "Created $KEYSTORE_FILE"
fi

verify_keystore "$KEYSTORE_FILE" "$KEY_ALIAS" "$KEYSTORE_PASSWORD" \
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
print_fingerprints "$KEYSTORE_FILE" "$KEY_ALIAS" "$KEYSTORE_PASSWORD"
echo
echo "Next: gh workflow run android-release.yml --repo $REPO"
