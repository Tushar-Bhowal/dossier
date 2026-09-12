import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

// Mirrors the brief's own §9 example (http://localhost:8099/acme/) — one local server hosting each
// fixture "company" under a path prefix, sharing one origin. That is also why robots.txt lives at
// the server root rather than per-company: url.origin has no path, so that is the only place
// httpFetcher will ever look for it.
const ROOT = join(fileURLToPath(import.meta.url), '..');
const PORT = Number(process.env.PORT ?? 8099);

const CONTENT_TYPES = {
  '.html': 'text/html',
  '.xml': 'text/xml',
  '.txt': 'text/plain',
};

function resolveFile(pathname) {
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  if (safe === '/robots.txt') return join(ROOT, 'robots.txt');
  if (safe.endsWith('/')) return join(ROOT, 'sites', safe, 'index.html');
  if (safe.endsWith('.xml') || safe.endsWith('.txt')) return join(ROOT, 'sites', safe);
  return join(ROOT, 'sites', `${safe}.html`);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const filePath = resolveFile(url.pathname);
  const ext = filePath.slice(filePath.lastIndexOf('.'));

  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'content-type': CONTENT_TYPES[ext] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

server.listen(PORT, () => {
  console.log(`Fixture site serving on http://localhost:${PORT}/  (acme, ghostco)`);
});
