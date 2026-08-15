/**
 * Local dev server for the api/ functions — no Vercel CLI required.
 *   node api/dev.mjs       → http://localhost:3000/api/{solve,chat}
 * Reads api/.env for OPENAI_API_KEY / OPENAI_MODEL.
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load api/.env
{
  const p = path.join(__dirname, '.env');
  if (existsSync(p)) {
    for (const line of (await readFile(p, 'utf8')).split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const solve = (await import('./solve.mjs')).default;
const chat = (await import('./chat.mjs')).default;

const server = http.createServer(async (req, res) => {
  const json = (code, body) => {
    res.writeHead(code, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(JSON.stringify(body));
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const url = (req.url ?? '').split('?')[0];
  if (req.method === 'POST' && url === '/api/solve') {
    let body = '';
    for await (const chunk of req) body += chunk;
    req.body = JSON.parse(body || '{}');
    return solve(req, { status: (c) => ({ json: (b) => json(c, b) }) });
  }
  if (req.method === 'POST' && url === '/api/chat') {
    let body = '';
    for await (const chunk of req) body += chunk;
    req.body = JSON.parse(body || '{}');
    return chat(req, { status: (c) => ({ json: (b) => json(c, b) }) });
  }
  return json(404, { error: 'not found' });
});

const PORT = Number(process.env.PORT ?? 3000);
server.listen(PORT, () => console.log(`api dev server on http://localhost:${PORT}`));
