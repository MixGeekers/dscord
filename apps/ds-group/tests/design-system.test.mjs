// The design system's rules for every stylesheet: text takes a role, spacing and radius come from the scale,
// and every var() names something that exists. See 前端架构与设计规范.md, "设计系统第二版".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { packageRoot } from '../src/paths.mjs';

const read = file => readFile(path.join(packageRoot, file), 'utf8');
const tokensCss = await read('web/tokens.css');
/** The page stylesheets: they lay out pages and may only use what the design system offers. */
const PAGES = ['web/styles.css', 'web/markdown.css', 'admin/src/styles.css', 'admin/central/src/styles.css', 'dsh-connect/client/styles.ts', 'ui/showcase/showcase.css'];
/** The design system's own controls. Sizes there come from tokens too, so the only literal length is a 1px hairline. */
const SYSTEM = 'ui/styles.css';

const tokens = new Set(Array.from(tokensCss.matchAll(/^\s*(--[\w-]+):/gm), match => match[1]));
const stripComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Every declaration in a stylesheet, with the selector it belongs to. Media query preludes are not declarations. */
function declarations(css) {
  const found = [];
  for (const [, selector, body] of stripComments(css).matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    if (!body.includes(':')) continue;
    for (const part of body.split(';')) {
      const colon = part.indexOf(':');
      if (colon < 0) continue;
      const property = part.slice(0, colon).trim();
      if (!/^-?-?[a-z][\w-]*$/.test(property)) continue;
      found.push({ selector: selector.trim().split('\n').pop().trim(), property, value: part.slice(colon + 1).replace(/!important/, '').trim() });
    }
  }
  return found;
}

/** Custom properties that pages set themselves: in their own rules, or on elements from components. */
async function localProperties() {
  const names = new Set();
  for (const file of [...PAGES, SYSTEM]) for (const [, name] of stripComments(await read(file)).matchAll(/(--[\w-]+)\s*:/g)) names.add(name);
  async function scan(directory) {
    for (const entry of await readdir(path.join(packageRoot, directory), { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await scan(file);
      else if (/\.(tsx?|js|mjs)$/.test(entry.name)) for (const [, name] of (await read(file)).matchAll(/["'`](--[\w-]+)["'`]/g)) names.add(name);
    }
  }
  for (const directory of ['web/src', 'web', 'admin/src', 'admin/central/src', 'ui', 'dsh-connect/client']) await scan(directory).catch(() => {});
  return names;
}

const SPACING = /^(padding|margin|gap|row-gap|column-gap|inset-inline|inset-block)(-[a-z-]+)?$|^(border(-[a-z]+)*-radius|outline-offset|scroll-padding|scroll-margin)/;
/** A literal length: a number with a unit other than %, fr, viewport units or a 0/±1px hairline. */
const LENGTH = /(?<![\w.#-])-?(\d*\.?\d+)(px|rem|em)\b/g;
const literalLengths = (value, allowHairline = true) => Array.from(value.matchAll(LENGTH))
  .filter(([, number, unit]) => !(allowHairline && unit === 'px' && (Number(number) === 1 || Number(number) === 0)))
  .map(([match]) => match);

test('the token file has the narrowed scales and the text roles, ordered by importance', () => {
  const names = prefix => Array.from(tokens).filter(name => name.startsWith(prefix));
  assert.deepEqual(names('--font-size-'), ['--font-size-xs', '--font-size-sm', '--font-size-md', '--font-size-lg', '--font-size-xl', '--font-size-2xl']);
  assert.deepEqual(names('--space-'), ['--space-2xs', '--space-xs', '--space-sm', '--space-md', '--space-lg', '--space-xl', '--space-2xl', '--space-3xl', '--space-4xl']);
  assert.deepEqual(names('--radius-'), ['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-pill', '--radius-round']);
  const roles = names('--text-');
  assert.deepEqual(roles, ['--text-display', '--text-title', '--text-heading', '--text-message', '--text-body-strong', '--text-body', '--text-label', '--text-caption', '--text-micro', '--text-code']);
  const value = name => tokensCss.match(new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm'))[1];
  const size = role => Number(value(value(role).match(/var\((--font-size-[\w]+)\)/)[1]).replace('rem', ''));
  // A heading is never smaller than body text, and a label or a caption is never larger than it: the inversions on the
  // Bot pages (a section title smaller than its own empty state) cannot be written with roles.
  for (let index = 1; index < roles.length - 1; index++) assert.ok(size(roles[index - 1]) >= size(roles[index]), `${roles[index - 1]} is smaller than ${roles[index]}`);
});

test('page stylesheets set text through roles and spacing through the scale', async () => {
  const local = await localProperties();
  const problems = [];
  for (const file of PAGES) {
    for (const { selector, property, value } of declarations(await read(file))) {
      const at = `${file}: ${selector} { ${property}: ${value} }`;
      if (property === 'font-size') problems.push(`${at} — use font: var(--text-…)`);
      if (property === 'font' && !/^(var\(--text-[\w-]+\)|inherit)$/.test(value)) problems.push(`${at} — font takes a text role`);
      if (property === 'font-weight' && !/^(var\(--font-weight-[\w]+\)|inherit|normal)$/.test(value)) problems.push(`${at} — use a --font-weight token`);
      if ((property === 'line-height' || property === 'letter-spacing') && literalLengths(value, false).some(length => !length.endsWith('em') || property === 'line-height')) problems.push(`${at} — no lengths in ${property}`);
      if (SPACING.test(property) && literalLengths(value).length) problems.push(`${at} — use the --space / --radius scale`);
      if (/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(value) && !property.startsWith('--')) problems.push(`${at} — colours come from tokens`);
      for (const [, name] of value.matchAll(/var\((--[\w-]+)/g)) if (!tokens.has(name) && !local.has(name)) problems.push(`${at} — ${name} is not a token`);
    }
  }
  assert.deepEqual(problems, []);
});

test('the design system controls use tokens for every size', async () => {
  const css = await read(SYSTEM);
  const problems = [];
  for (const { selector, property, value } of declarations(css)) {
    const at = `${SYSTEM}: ${selector} { ${property}: ${value} }`;
    if (property === 'font-size' || (property === 'font' && !/^(var\(--text-[\w-]+\)|inherit)$/.test(value))) problems.push(`${at} — text takes a role`);
    if (literalLengths(value).length) problems.push(`${at} — sizes come from tokens`);
    if (/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(value)) problems.push(`${at} — colours come from tokens`);
    for (const [, name] of value.matchAll(/var\((--[\w-]+)/g)) if (!tokens.has(name) && !name.startsWith('--anchor-') && !name.startsWith('--available-') && !name.startsWith('--transform-')) problems.push(`${at} — ${name} is not a token`);
  }
  assert.deepEqual(problems, []);
});

test('the components draw themselves with ds-* classes, so the DSH page gets them without Tailwind', async () => {
  for (const file of ['ui/controls.tsx', 'ui/form.tsx', 'ui/layout.tsx', 'ui/select.tsx']) {
    const source = await read(file);
    for (const [, classes] of source.matchAll(/className=(?:\{cn\()?"([^"]+)"/g)) {
      for (const name of classes.split(/\s+/)) assert.ok(name.startsWith('ds-') || file === 'ui/controls.tsx', `${file} uses ${name}`);
    }
  }
  const pages = (await Promise.all(['web/src', 'admin/src', 'admin/central/src'].map(async directory => {
    const files = [];
    async function scan(folder) {
      for (const entry of await readdir(path.join(packageRoot, folder), { withFileTypes: true })) {
        if (entry.isDirectory()) await scan(path.join(folder, entry.name));
        else if (entry.name.endsWith('.tsx')) files.push(path.join(folder, entry.name));
      }
    }
    await scan(directory);
    return files;
  }))).flat();
  for (const file of pages) {
    const source = await read(file);
    assert.doesNotMatch(source, /<select\b/, `${file} uses a native <select>; use Select from ui/select.tsx`);
    assert.doesNotMatch(source, /\bNativeSelect\b/, `${file} still uses NativeSelect`);
  }
});
