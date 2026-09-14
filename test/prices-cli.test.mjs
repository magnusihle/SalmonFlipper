import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const script = new URL('../scripts/prices.mjs', import.meta.url).pathname;
const residual = new URL('./fixtures/residual-w38.json', import.meta.url).pathname;

test('prices CLI prints the panel and values a residual file, and --set moves the total', async () => {
  const base = await run('node', [script, '--week', '2026-W38', '--residual', residual]);
  assert.match(base.stdout, /HOG\s+reference/);
  assert.match(base.stdout, /TRIM_E\s+derived/);
  assert.match(base.stdout, /FRAME\s+703/);
  assert.match(base.stdout, /Residual total/);
  assert.match(base.stdout, /Unallocated raw\s+1014/);
  const total = Number(/Residual total\s+([\d.]+)/.exec(base.stdout)[1]);

  const changed = await run('node', [script, '--week', '2026-W38', '--residual', residual, '--set', 'FRAME=10']);
  const total2 = Number(/Residual total\s+([\d.]+)/.exec(changed.stdout)[1]);
  assert.ok(Math.abs(total2 - total - 703 * 7) < 1, `${total2} vs ${total}`);
});
