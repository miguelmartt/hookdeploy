// Cross-platform syntax check: runs `node --check` on every JS file.
// No shell globs, so it works the same on Windows (pnpm/npm run lint),
// Linux and macOS. New files in src/ or tests/ are picked up automatically.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = ['server.js', 'test.js'];

for (const dir of ['src', 'tests', 'scripts']) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) continue;
  for (const entry of fs.readdirSync(full)) {
    if (entry.endsWith('.js')) files.push(path.join(dir, entry));
  }
}

let failed = false;
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
  } catch (_) {
    failed = true;
  }
}

if (failed) {
  console.error('lint: syntax errors found');
  process.exit(1);
} else {
  console.log(`lint: ${files.length} files OK`);
}
