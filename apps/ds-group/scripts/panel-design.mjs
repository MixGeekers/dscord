// Writes the DSH page's design system (dsh-connect/client/design.ts) from the web pages' own sources: every token in
// web/tokens.css and every control rule in ui/styles.css. The page inside DSH is drawn by the same CSS as the web
// pages, kept under one class so that nothing leaks into DSH's own pages and DSH's styles do not decide how it looks.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const tokenSource = path.join(root, 'web/tokens.css');
export const controlSource = path.join(root, 'ui/styles.css');
export const designOutput = path.join(root, 'dsh-connect/client/design.ts');
/** The class everything is kept under: the page itself, and anything of ours that DSH shows elsewhere. */
export const SCOPE = '.dscord-ui';
/** How DSH marks its dark theme. Without it the page is light. */
const DARK = 'body[data-ds-dark-theme]';

function block(css, selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`web/tokens.css has no ${selector} block`);
  return css.slice(css.indexOf('{', start) + 1, css.indexOf('\n}', start));
}

const declarations = body => new Map(Array.from(body.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm), match => [match[1], match[2].trim()]));

/** A selector list split at its top-level commas. */
function selectors(prelude) {
  const parts = [];
  let depth = 0;
  let from = 0;
  for (let index = 0; index < prelude.length; index++) {
    const character = prelude[index];
    if (character === '(' || character === '[') depth++;
    else if (character === ')' || character === ']') depth--;
    else if (character === ',' && depth === 0) { parts.push(prelude.slice(from, index)); from = index + 1; }
  }
  return [...parts, prelude.slice(from)].map(part => part.trim().replace(/\s+/g, ' '));
}

/** The same rules with every selector under `scope`. Only plain rules and @media are expected in ui/styles.css. */
export function scoped(css, scope, indent = '') {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf('{', index);
    if (open < 0) {
      if (text.slice(index).trim()) throw new Error('ui/styles.css ends inside a rule');
      break;
    }
    let close = open;
    for (let depth = 1; depth > 0;) {
      close++;
      if (close >= text.length) throw new Error('ui/styles.css has an unclosed rule');
      if (text[close] === '{') depth++;
      else if (text[close] === '}') depth--;
    }
    const prelude = text.slice(index, open).trim();
    const body = text.slice(open + 1, close);
    if (prelude.startsWith('@media')) rules.push(`${indent}${prelude} {\n${scoped(body, scope, `${indent}  `)}\n${indent}}`);
    else if (prelude.startsWith('@')) throw new Error(`ui/styles.css uses ${prelude.split(' ')[0]}, which the DSH page cannot scope`);
    else {
      const lines = body.split(';').map(line => line.trim().replace(/\s+/g, ' ')).filter(Boolean);
      rules.push(`${indent}${selectors(prelude).map(selector => `${scope} ${selector}`).join(', ')} { ${lines.join('; ')}; }`);
    }
    index = close + 1;
  }
  return rules.join('\n');
}

/** The text of dsh-connect/client/design.ts. */
export async function panelDesign() {
  const css = await readFile(tokenSource, 'utf8');
  const dark = declarations(block(css, ':root'));
  const light = declarations(block(css, ':root[data-theme="light"]'));
  for (const name of light.keys()) if (!dark.has(name)) throw new Error(`web/tokens.css sets ${name} only for the light theme`);
  const reduced = Array.from(dark.keys()).filter(name => name.startsWith('--motion-'));
  const line = ([name, value]) => `  ${name}: ${value};`;
  const sheet = [
    `${SCOPE} {`, '  color-scheme: light;', ...Array.from(new Map([...dark, ...light]), line), '}',
    `${DARK} ${SCOPE} {`, '  color-scheme: dark;', ...Array.from(light.keys(), name => line([name, dark.get(name)])), '}',
    '@media (prefers-reduced-motion: reduce) {', `  ${SCOPE} { ${reduced.map(name => `${name}: 0ms;`).join(' ')} }`, '}',
    scoped(await readFile(controlSource, 'utf8'), SCOPE),
  ].join('\n');
  if (sheet.includes('`') || sheet.includes('${')) throw new Error('the design sources cannot be written into a template literal');
  return '// Generated from web/tokens.css and ui/styles.css by `npm run build:dsh-client` (scripts/panel-design.mjs). Do not edit by hand.\n'
    + '/** DSCord\'s design system for the page inside DSH: the web pages\' tokens and control styles, kept under one class. */\n'
    + `export const design = \`\n${sheet.replaceAll('\\', '\\\\')}\n\`;\n`;
}
