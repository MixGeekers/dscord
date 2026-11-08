import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { packageRoot } from '../src/paths.mjs';

const lintFiles = [];
const lintable = filename => !path.relative(packageRoot, filename).split(path.sep).some(part => part === 'dist' || part === 'licenses');
async function checkDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') await checkDirectory(filename);
    else if (/\.(mjs|js)$/.test(entry.name)) {
      const result = spawnSync(process.execPath, ['--check', filename], { stdio: 'inherit' });
      if (result.status !== 0) process.exit(result.status || 1);
      if (lintable(filename)) lintFiles.push(path.relative(packageRoot, filename));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts') && lintable(filename)) lintFiles.push(path.relative(packageRoot, filename));
  }
}
for (const folder of ['bin', 'src', 'memory', 'scripts', 'web', 'admin', 'ui', 'tests', 'dsh-plugin', 'dsh-connect']) await checkDirectory(path.join(packageRoot, folder));
// Lint rules live in .oxlintrc.json. Files are passed explicitly so an extracted release inside an ignored directory is still linted.
const lint = spawnSync(process.execPath, [path.join(packageRoot, 'node_modules', 'oxlint', 'bin', 'oxlint'), '--quiet', ...lintFiles], { cwd: packageRoot, stdio: 'inherit' });
if (lint.status !== 0) process.exit(lint.status ?? 1);
// Prettier formatting is enforced for the React sources.
const format = spawnSync(process.execPath, [path.join(packageRoot, 'node_modules', 'prettier', 'bin', 'prettier.cjs'), '--check', '--log-level=warn', 'web/src/**/*.{ts,tsx}', 'admin/src/**/*.{ts,tsx}', 'ui/**/*.{ts,tsx}'], { cwd: packageRoot, stdio: 'inherit' });
if (format.status !== 0) process.exit(format.status ?? 1);
const types = spawnSync(process.execPath, [path.join(packageRoot, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit'], {
  cwd: packageRoot, stdio: 'inherit',
});
if (types.status !== 0) process.exit(types.status ?? 1);
const adminTypes = spawnSync(process.execPath, [path.join(packageRoot, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'admin/tsconfig.json', '--noEmit'], { cwd: packageRoot, stdio: 'inherit' });
if (adminTypes.status !== 0) process.exit(adminTypes.status ?? 1);
const tests = spawnSync(process.execPath, ['--test', 'tests/*.test.mjs'], { cwd: packageRoot, stdio: 'inherit' });
if (tests.error) console.error(tests.error.message);
process.exit(tests.status ?? 1);
