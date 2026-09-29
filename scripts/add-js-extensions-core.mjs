import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';

const coreDir = 'H:/customers/game/platform/packages/lobby-sdk/src/core';

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

let n = 0;
for (const file of walk(coreDir)) {
  const raw = readFileSync(file, 'utf8');
  const next = raw.replace(
    /(from\s+|import\()\s*['"](\.[^'"]+)['"]/g,
    (all, prefix, spec) => {
      if (spec.endsWith('.js') || spec.endsWith('.json')) return all;
      // type-only paths and relative modules
      const neu = `${spec}.js`;
      n += 1;
      return `${prefix}'${neu}'`;
    },
  );
  if (next !== raw) writeFileSync(file, next);
}
console.log('added .js to', n, 'imports');
