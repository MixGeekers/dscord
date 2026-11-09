import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bundleDshClient, clientOutput } from '../scripts/build-dsh-client.mjs';

test('the committed DSH client is the current build of dsh-connect/client/', async () => {
  const built = await bundleDshClient();
  assert.ok(built.startsWith('// Generated from dsh-connect/client/'));
  assert.ok(built.includes("window.__ModuleLoader__.load({\n  id: 'dscord',"));
  for (const name of ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives']) assert.ok(built.includes(`require("${name}")`), name);
  assert.equal(await readFile(clientOutput, 'utf8'), built, 'run `npm run build:dsh-client` and commit dsh-connect/client.js');
});
