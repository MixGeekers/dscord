// Writes the DSH page's tokens (dsh-connect/client/tokens.ts) from web/tokens.css, so the page inside DSH and the
// web pages share one scale and one set of token names. Colours follow DSH's own theme and fall back to ours.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const tokenSource = path.join(root, 'web/tokens.css');
export const tokenOutput = path.join(root, 'dsh-connect/client/tokens.ts');

/** Our token, and the DSH token that supplies its value while the page is inside DSH. */
const HOST = {
  '--font-family-ui': '--dsw-font-family',
  '--radius-lg': '--dsw-radius-md',
  '--radius-xl': '--dsw-radius-lg',
  '--color-bg-primary': '--dsw-alias-bg-layer-1',
  '--color-bg-secondary': '--dsw-alias-settings-card-fill',
  '--color-bg-input': '--dsw-alias-bg-layer-1',
  '--color-bg-hover': '--dsw-alias-interactive-bg-hover',
  '--color-text-primary': '--dsw-alias-label-primary',
  '--color-text-muted': '--dsw-alias-label-secondary',
  '--color-border-subtle': '--dsw-alias-settings-card-stroke',
  '--color-border-normal': '--dsw-alias-settings-card-stroke',
  '--color-accent': '--dsw-alias-state-business-primary',
  '--color-focus': '--dsw-alias-state-business-primary',
  '--color-link': '--dsw-alias-link',
  '--color-status-success': '--dsw-alias-state-success-primary',
  '--color-status-warning': '--dsw-alias-state-warn-primary',
  '--color-status-danger': '--dsw-alias-state-error-primary',
  '--color-text-danger': '--dsw-alias-state-error-primary',
};
/** Tokens the page takes from web/tokens.css as they are. */
const SHARED = /^--(font-size-|font-weight-|line-height-|space-|radius-|focus-width$|motion-fast$|opacity-disabled$|font-family-code$|size-avatar-message$|color-text-on-accent$)/;

function declarations(css, selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`web/tokens.css has no ${selector} block`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('\n}', start));
  return new Map(Array.from(body.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm), match => [match[1], match[2].trim()]));
}

/** The text of dsh-connect/client/tokens.ts. */
export async function panelTokens() {
  const css = await readFile(tokenSource, 'utf8');
  const dark = declarations(css, ':root');
  const light = new Map([...dark, ...declarations(css, ':root[data-theme="light"]')]);
  const literal = (values, name) => {
    const value = values.get(name);
    if (value === undefined) throw new Error(`web/tokens.css has no ${name}`);
    const reference = /^var\((--[\w-]+)\)$/.exec(value);
    return reference ? literal(values, reference[1]) : value;
  };
  const bridged = values => Object.entries(HOST).map(([name, host]) => `  ${name}: var(${host}, ${literal(values, name)});`);
  const shared = Array.from(dark.keys()).filter(name => SHARED.test(name) && !(name in HOST)).map(name => `  ${name}: ${literal(dark, name)};`);
  const sheet = [
    '.dscord-connect {', '  color-scheme: light;', ...shared, ...bridged(light), '}',
    'body[data-ds-dark-theme] .dscord-connect {', '  color-scheme: dark;',
    ...bridged(dark).filter(line => !/--(font-family-ui|radius-)/.test(line)), '}',
    '@media (prefers-reduced-motion: reduce) {', '  .dscord-connect { --motion-fast: 0ms; }', '}',
  ].join('\n');
  return '// Generated from web/tokens.css by `npm run build:dsh-client` (scripts/panel-tokens.mjs). Do not edit by hand.\n'
    + '/** The design tokens the page uses: the web pages\' scale and names, coloured by DSH\'s theme. */\n'
    + `export const tokens = \`\n${sheet}\n\`;\n`;
}
