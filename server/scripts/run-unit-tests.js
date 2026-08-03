/**
 * Cross-platform unit test runner for Node's test runner.
 * Avoids shell glob expansion differences (Windows vs Linux CI).
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testDir = path.join(__dirname, '..', 'test');
const files = fs
  .readdirSync(testDir)
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => path.join(testDir, name));

if (files.length === 0) {
  console.error(`No *.test.js files found in ${testDir}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status === null ? 1 : result.status);
