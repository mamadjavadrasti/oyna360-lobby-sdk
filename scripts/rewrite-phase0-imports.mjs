import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'fs';
import { join, relative, dirname } from 'path';

const src = 'H:/customers/game/platform/packages/lobby-sdk/src';
const coreDir = join(src, 'core');
const babylonRoot = join(src, 'renderers/babylon');

const coreFiles = new Set(
  readdirSync(coreDir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => f.replace(/\.ts$/, '')),
);

const uiFiles = new Set([
  'lobby-chat-ui',
  'lobby-presence-ui',
  'lobby-voice-ui',
  'lobby-connection-ui',
  'lobby-orientation-ui',
]);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

function toPosix(p) {
  return p.replace(/\\/g, '/');
}

function rewriteImport(fromFile, spec) {
  if (!spec.startsWith('.')) return spec;
  const cleaned = spec.replace(/\.js$/, '');
  const base = cleaned.split('/').pop();
  const fromDir = dirname(fromFile);
  const fromPosix = toPosix(fromFile);
  const inCore = fromPosix.includes('/core/');
  const inBabylon = fromPosix.includes('/renderers/babylon/');

  if (inCore) {
    if (coreFiles.has(base)) return `./${base}`;
    return spec;
  }

  if (!inBabylon) return spec;

  if (coreFiles.has(base)) {
    return toPosix(relative(fromDir, join(coreDir, base)));
  }
  if (base === 'platform-lobby') {
    return toPosix(relative(fromDir, join(babylonRoot, 'platform-lobby')));
  }
  if (cleaned.includes('playground/')) {
    const name = cleaned.split('playground/').pop();
    return toPosix(relative(fromDir, join(babylonRoot, 'playground', name)));
  }
  if (base === 'playground-layout' || base === 'playground-system') {
    return toPosix(relative(fromDir, join(babylonRoot, 'playground', base)));
  }
  if (uiFiles.has(base)) {
    return toPosix(relative(fromDir, join(babylonRoot, 'ui', base)));
  }
  if (existsSync(join(babylonRoot, `${base}.ts`))) {
    return toPosix(relative(fromDir, join(babylonRoot, base)));
  }
  return spec;
}

let changed = 0;
const files = [...walk(coreDir), ...walk(babylonRoot)];
for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const next = raw.replace(
    /(from\s+|import\()\s*['"](\.\.?\/[^'"]+)['"]/g,
    (all, prefix, spec) => {
      const neu = rewriteImport(file, spec);
      if (neu === spec) return all;
      changed += 1;
      const normalized = neu.startsWith('.') ? neu : `./${neu}`;
      return `${prefix}'${normalized}'`;
    },
  );
  if (next !== raw) writeFileSync(file, next);
}
console.log('rewrites', changed, 'files', files.length);
