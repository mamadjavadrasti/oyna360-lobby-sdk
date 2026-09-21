/**
 * Monorepo: sync protocol from packages/lobby-protocol.
 * Standalone GitHub/npm checkout: protocol.ts is already vendored — skip.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const monorepoSync = join(here, '../../../scripts/sync-lobby-protocol.mjs');

if (!existsSync(monorepoSync)) {
  console.log('lobby-sdk prebuild: standalone package — skip protocol sync');
  process.exit(0);
}

const check = process.argv.includes('--check');
const result = spawnSync(process.execPath, [monorepoSync, ...(check ? ['--check'] : [])], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
