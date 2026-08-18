#!/usr/bin/env bash
# Preflight for the Android Release job: fails fast, with the names of the
# credentials that are missing, instead of burning a 10-minute Gradle build and
# then shipping a debug-signed AAB (which Play rejects) or silently skipping the
# Play upload. Never prints a secret's value — only whether it is set.
set -uo pipefail

STRICT="${STRICT_ANDROID_SECRETS:-1}"
missing=()

check() {
  local name="$1" detail="${2-}"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    missing+=("$name")
    printf '  MISSING  %-34s %s\n' "$name" "$detail"
  else
    printf '  ok       %-34s\n' "$name"
  fi
}

echo "Checking Android release credentials (values are never printed)"

check ANDROID_KEYSTORE_BASE64 "base64 of the upload keystore"
check ANDROID_KEYSTORE_PASSWORD "keystore (store) password"
check ANDROID_KEY_ALIAS "key alias inside the keystore"
check ANDROID_KEY_PASSWORD "password of that key"
check GOOGLE_PLAY_SERVICE_ACCOUNT_JSON "Play Console service account JSON"
check EXPO_PUBLIC_API_BASE_URL "backend URL baked into the bundle"
check EXPO_PUBLIC_REVENUECAT_KEY "RevenueCat Android SDK key (goog_...)"

# Cheap structural checks so a malformed secret is caught here rather than
# halfway through the build.
if [[ -n "${GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:-}" ]]; then
  if ! python3 -c '
import json, os, sys
try:
    sa = json.loads(os.environ["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"])
except Exception as err:
    sys.exit(f"not valid JSON ({err})")
for field in ("type", "client_email", "private_key"):
    if not sa.get(field):
        sys.exit(f"missing {field!r}")
if sa["type"] != "service_account":
    sys.exit("type is %r, expected \"service_account\"" % sa["type"])
'; then
    missing+=("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (malformed)")
    echo "  MALFORMED GOOGLE_PLAY_SERVICE_ACCOUNT_JSON — paste the whole downloaded JSON file"
  fi
fi

# CI always has keytool via setup-java; openssl keeps this runnable on a Mac
# with no JDK installed.
if command -v keytool >/dev/null 2>&1; then
  keystore_check=keytool
elif command -v openssl >/dev/null 2>&1; then
  keystore_check=openssl
else
  keystore_check=""
fi

if [[ -n "${ANDROID_KEYSTORE_BASE64:-}" && -n "$keystore_check" ]]; then
  tmp_keystore="$(mktemp)"
  trap 'rm -f "$tmp_keystore"' EXIT
  if ! echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > "$tmp_keystore" 2>/dev/null; then
    missing+=("ANDROID_KEYSTORE_BASE64 (not valid base64)")
    echo "  MALFORMED ANDROID_KEYSTORE_BASE64 — re-encode with: base64 -w0 upload-keystore.p12"
  elif [[ -n "${ANDROID_KEYSTORE_PASSWORD:-}" && -n "${ANDROID_KEY_ALIAS:-}" ]]; then
    if [[ "$keystore_check" == keytool ]]; then
      keytool -list -keystore "$tmp_keystore" -storetype PKCS12 \
        -storepass "$ANDROID_KEYSTORE_PASSWORD" \
        -alias "$ANDROID_KEY_ALIAS" >/dev/null 2>&1
    else
      # openssl can prove the password opens the store, but not the alias.
      openssl pkcs12 -in "$tmp_keystore" -nokeys \
        -passin pass:"$ANDROID_KEYSTORE_PASSWORD" >/dev/null 2>&1
    fi
    if (( $? != 0 )); then
      missing+=("keystore/password/alias mismatch")
      echo "  MISMATCH ANDROID_KEYSTORE_PASSWORD or ANDROID_KEY_ALIAS does not open the keystore"
    else
      echo "  ok       keystore opens with the given password${keystore_check:+ (checked with $keystore_check)}"
    fi
  fi
fi

if (( ${#missing[@]} == 0 )); then
  echo "All Android release credentials present."
  exit 0
fi

echo
echo "Missing or invalid: ${missing[*]}"
echo "Add them with: bash scripts/setup-android-secrets.sh"
echo "Details: docs/android-release.md"

if [[ "$STRICT" == "0" ]]; then
  echo "STRICT_ANDROID_SECRETS=0 — continuing anyway."
  exit 0
fi
exit 1
