#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="${ANDROID_DIR:-$ROOT_DIR/android}"
GRADLE_FILE="$ANDROID_DIR/app/build.gradle"
KEYSTORE_PROPS="$ANDROID_DIR/keystore.properties"

if [[ ! -f "$GRADLE_FILE" ]]; then
  echo "error: $GRADLE_FILE not found — run expo prebuild first" >&2
  exit 1
fi

if [[ -z "${ANDROID_KEYSTORE_BASE64:-}" ]]; then
  echo "warn: ANDROID_KEYSTORE_BASE64 unset — release build stays debug-signed" >&2
  exit 0
fi

: "${ANDROID_KEYSTORE_PASSWORD:?ANDROID_KEYSTORE_PASSWORD is required}"
: "${ANDROID_KEY_ALIAS:?ANDROID_KEY_ALIAS is required}"
: "${ANDROID_KEY_PASSWORD:?ANDROID_KEY_PASSWORD is required}"

KEYSTORE_FILENAME="${ANDROID_KEYSTORE_FILENAME:-upload-keystore.p12}"
if base64 --help 2>&1 | grep -q -- '--decode'; then
  echo "$ANDROID_KEYSTORE_BASE64" | base64 --decode > "$ANDROID_DIR/app/$KEYSTORE_FILENAME"
else
  echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > "$ANDROID_DIR/app/$KEYSTORE_FILENAME"
fi

cat > "$KEYSTORE_PROPS" <<EOF
storePassword=$ANDROID_KEYSTORE_PASSWORD
keyPassword=$ANDROID_KEY_PASSWORD
keyAlias=$ANDROID_KEY_ALIAS
storeFile=$KEYSTORE_FILENAME
EOF

export GRADLE_FILE
python3 <<'PY'
import os
import pathlib

gradle_path = pathlib.Path(os.environ["GRADLE_FILE"])
content = gradle_path.read_text()

loader = """
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
"""

if "keystorePropertiesFile" not in content:
    content = content.replace("android {", "android {" + loader, 1)

marker = """        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {"""

release_block = """        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (keystoreProperties['storeFile']) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
    buildTypes {"""

if marker not in content:
    raise SystemExit("error: android/app/build.gradle layout changed — update configure-android-signing.sh")

content = content.replace(marker, release_block, 1)
content = content.replace(
    """        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug""",
    """        release {
            signingConfig signingConfigs.release""",
    1,
)

gradle_path.write_text(content)
print("configured release signing in", gradle_path)
PY