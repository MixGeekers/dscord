import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bundleDshClient, clientOutput } from '../scripts/build-dsh-client.mjs';
import { panelTokens, tokenOutput } from '../scripts/panel-tokens.mjs';

test('the committed DSH client is the current build of dsh-connect/client/', async () => {
  const built = await bundleDshClient();
  assert.ok(built.startsWith('// Generated from dsh-connect/client/'));
  assert.ok(built.includes("window.__ModuleLoader__.load({\n  id: 'dscord',"));
  for (const name of ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives']) assert.ok(built.includes(`require("${name}")`), name);
  assert.equal(await readFile(clientOutput, 'utf8'), built, 'run `npm run build:dsh-client` and commit dsh-connect/client.js');
});

test('the DSH page takes its tokens from web/tokens.css and its styles use nothing else', async () => {
  const tokens = await panelTokens();
  assert.equal(await readFile(tokenOutput, 'utf8'), tokens, 'run `npm run build:dsh-client` and commit dsh-connect/client/tokens.ts');
  const web = await readFile(new URL('../web/tokens.css', import.meta.url), 'utf8');
  const defined = new Set(Array.from(tokens.matchAll(/^\s*(--[\w-]+):/gm), match => match[1]));
  for (const name of defined) assert.ok(web.includes(`${name}:`), `${name} is a web token`);
  const styles = (await readFile(new URL('../dsh-connect/client/styles.ts', import.meta.url), 'utf8')).replace(/^\/\/.*$/gm, '');
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b|rgba?\(|--dsw-|--dc-/i, 'colours come from tokens');
  for (const [, name] of styles.matchAll(/var\((--[\w-]+)/g)) assert.ok(defined.has(name), `${name} is not one of the page's tokens`);
  for (const [declaration] of styles.matchAll(/(?:font-size|gap|padding|margin|border-radius)[a-z-]*:[^;}]*\d(?:px|rem)/g)) assert.fail(`${declaration} bypasses the scale`);
});
