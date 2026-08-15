import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Load .env at repo root (EXPO_PUBLIC_* for the web dev server). */
export function loadAppEnv(): Record<string, string> {
  const envPath = path.resolve(__dirname, '../../.env');
  if (!existsSync(envPath)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
