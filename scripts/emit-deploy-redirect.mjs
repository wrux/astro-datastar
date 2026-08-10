// Re-emit demo's generated wrangler deploy redirect at the repo root, so
// `npx wrangler deploy` works from the root (Workers Builds runs it there).
// The Cloudflare adapter writes demo/.wrangler/deploy/config.json during
// `astro build`, with paths relative to that file; this rewrites them
// relative to <root>/.wrangler/deploy/config.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'demo/.wrangler/deploy/config.json');
const target = join(root, '.wrangler/deploy/config.json');

const redirect = JSON.parse(readFileSync(source, 'utf8'));
const rebase = (p) => relative(dirname(target), resolve(dirname(source), p));

for (const key of Object.keys(redirect)) {
  if (key.endsWith('Path') && typeof redirect[key] === 'string') {
    redirect[key] = rebase(redirect[key]);
  }
}

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(redirect));
console.log(`Wrote ${relative(root, target)} -> ${redirect.configPath}`);
