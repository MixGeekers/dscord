import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bundleDshClient, clientOutput } from '../scripts/build-dsh-client.mjs';
import { designOutput, panelDesign, scoped, SCOPE } from '../scripts/panel-design.mjs';

test('the committed DSH client is the current build of dsh-connect/client/', async () => {
  const built = await bundleDshClient();
  assert.ok(built.startsWith('// Generated from dsh-connect/client/'));
  assert.ok(built.includes("window.__ModuleLoader__.load({\n  id: 'dscord',"));
  for (const name of ['react', 'react/jsx-runtime', 'react-dom']) assert.ok(built.includes(`require("${name}")`), name);
  assert.deepEqual(Array.from(new Set(Array.from(built.matchAll(/\brequire\("([^"]+)"\)/g), match => match[1]))).sort(), ['react', 'react-dom', 'react/jsx-runtime'],
    'the page draws its own controls and takes nothing but React from DSH');
  assert.equal(await readFile(clientOutput, 'utf8'), built, 'run `npm run build:dsh-client` and commit dsh-connect/client.js');
});

test('the DSH page is drawn by the design system of the web pages: their tokens, their control rules, and nothing of its own', async () => {
  const design = await panelDesign();
  assert.equal(await readFile(designOutput, 'utf8'), design, 'run `npm run build:dsh-client` and commit dsh-connect/client/design.ts');
  assert.doesNotMatch(design, /--dsw-/, 'colours are DSCord\'s own, not the host\'s');

  // Every token of web/tokens.css is there with the light theme's value, and the dark theme's under DSH's dark mark.
  const web = await readFile(new URL('../web/tokens.css', import.meta.url), 'utf8');
  const block = (text, selector) => text.slice(text.indexOf('{', text.indexOf(`${selector} {`)) + 1, text.indexOf('\n}', text.indexOf(`${selector} {`)));
  const values = body => new Map(Array.from(body.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm), match => [match[1], match[2].trim()]));
  const [dark, light] = [values(block(web, ':root')), values(block(web, ':root[data-theme="light"]'))];
  const [pageLight, pageDark] = [values(block(design, SCOPE)), values(block(design, `body[data-ds-dark-theme] ${SCOPE}`))];
  assert.deepEqual(Object.fromEntries(pageLight), Object.fromEntries(new Map([...dark, ...light])));
  assert.deepEqual(Object.fromEntries(pageDark), Object.fromEntries(Array.from(light.keys(), name => [name, dark.get(name)])));

  // Every control rule of ui/styles.css is there unchanged, under the page's class so that it stays out of DSH's pages.
  const controls = await readFile(new URL('../ui/styles.css', import.meta.url), 'utf8');
  const rules = scoped(controls, SCOPE);
  assert.ok(design.includes(rules));
  const flat = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, '');
  assert.equal(flat(rules).replaceAll(SCOPE, ''), flat(controls).replace(/;}/g, ';}').replace(/([^;{}])}/g, '$1;}'), 'only the scope is added');
  for (const [, prelude] of rules.matchAll(/^\s*([^@{}\n][^{}\n]*)\{/gm)) {
    for (const selector of prelude.split(/,(?![^(]*\))/)) assert.ok(selector.trim().startsWith(`${SCOPE} `), `${selector.trim()} is not under ${SCOPE}`);
  }
  assert.throws(() => scoped('@font-face { font-family: x; }', SCOPE), /cannot scope/);
  assert.equal(scoped('.a:is(.b, .c) > p,\n.d { color: red; margin: 0 }', '.s'), '.s .a:is(.b, .c) > p, .s .d { color: red; margin: 0; }');
  // Keyframes keep their global names and stay unscoped, on one line; the loading animation is one of them.
  assert.equal(scoped('@keyframes ds-x { from { opacity: 0 } to { opacity: 1 } }', '.s'), '@keyframes ds-x { from { opacity: 0; } to { opacity: 1; } }');
  assert.match(design, /^@keyframes ds-loading-whale \{ 0% \{/m);

  // What the page adds itself uses tokens only.
  const defined = new Set(pageLight.keys());
  const styles = (await readFile(new URL('../dsh-connect/client/styles.ts', import.meta.url), 'utf8')).replace(/^\/\/.*$/gm, '');
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b|rgba?\(|--dsw-|--dc-/i, 'colours come from tokens');
  for (const [, name] of styles.matchAll(/var\((--[\w-]+)/g)) assert.ok(defined.has(name), `${name} is not a design token`);
  for (const [declaration] of styles.matchAll(/(?:font-size|gap|padding|margin|border-radius)[a-z-]*:[^;}]*\d(?:px|rem)/g)) assert.fail(`${declaration} bypasses the scale`);
  for (const [, name] of design.matchAll(/var\((--[\w-]+)/g)) assert.ok(defined.has(name), `${name} is used by a control and is not a design token`);
});

test('the loading animation in ui/styles.css is the current output of scripts/loading-motion.mjs', async () => {
  const { loadingMotion, stylesheet } = await import('../scripts/loading-motion.mjs');
  assert.ok((await readFile(stylesheet, 'utf8')).includes(loadingMotion()), 'run `node scripts/loading-motion.mjs` and commit ui/styles.css');
});
