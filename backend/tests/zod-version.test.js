'use strict';

// Guards the zod pin flagged by GHSA-mrhx-c7xc-m3w5 (zod < 4.6.6).
// zod is pulled in transitively by the frontend toolchain, so the committed
// lockfile is the source of truth. No network, no production data.
// Run: node --test tests/zod-version.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const readLock = (dir) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', dir, 'package-lock.json'), 'utf8'));

const gte = (a, b) => {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return true;
};

test('frontend lockfile pins a patched zod (>= 4.6.6)', () => {
  const lock = readLock('frontend');
  const entry = lock.packages['node_modules/zod'];
  assert.ok(entry, 'zod must be present in the frontend lockfile');
  assert.ok(
    gte(entry.version, '4.6.6'),
    `zod must be >= 4.6.6 (found ${entry.version})`
  );
});
