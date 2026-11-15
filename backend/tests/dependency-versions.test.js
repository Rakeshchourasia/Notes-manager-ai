'use strict';

// Guards the patched versions of security-relevant dependencies by reading the
// committed lockfiles (no network, no production data).
// Run: node --test tests/dependency-versions.test.js

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

const minimums = {
  backend: { mongoose: '9.9.2', multer: '2.5.0', 'body-parser': '2.4.0', 'proxy-addr': '2.0.8', 'brace-expansion': '5.0.9', 'path-to-regexp': '8.4.0', picomatch: '2.3.2' },
  frontend: { axios: '1.15.2', 'react-router': '7.14.2', 'react-router-dom': '7.14.2', dompurify: '3.4.17', flatted: '3.4.2', 'form-data': '4.0.6', 'js-yaml': '4.3.0', nanoid: '3.3.12', postcss: '8.5.12', 'source-map-js': '1.2.2', uuid: '11.1.1', vite: '7.3.2' },
};

for (const [project, pins] of Object.entries(minimums)) {
  test(`${project} lockfile pins patched dependency versions`, () => {
    const lock = readLock(project);
    for (const [name, minimum] of Object.entries(pins)) {
      const entry = lock.packages[`node_modules/${name}`];
      assert.ok(entry, `${name} must be present in the lockfile`);
      assert.ok(gte(entry.version, minimum), `${name} must be >= ${minimum} (found ${entry.version})`);
    }
  });
}