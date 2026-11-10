// Builds the DSH plugin page (dsh-connect/client/) into dsh-connect/client.js, the one file DSH loads.
// DSH supplies React and react-dom at run time, so they stay outside the bundle. The controls are DSCord's own.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { designOutput, panelDesign } from './panel-design.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const clientSource = path.join(root, 'dsh-connect/client');
export const clientOutput = path.join(root, 'dsh-connect/client.js');
const HEADER = '// Generated from dsh-connect/client/ by `npm run build:dsh-client` (scripts/build-dsh-client.mjs). Do not edit by hand.\n';
const EXTERNAL = ['react', 'react/jsx-runtime', 'react-dom'];

/** Bundles the page and wraps it in the module loader call DSH expects; returns the file's text. */
export async function bundleDshClient() {
  const result = await build({
    configFile: false,
    logLevel: 'warn',
    root,
    build: {
      write: false,
      minify: false,
      sourcemap: false,
      emptyOutDir: false,
      lib: { entry: path.join(clientSource, 'index.tsx'), formats: ['cjs'], fileName: () => 'client.cjs' },
      rolldownOptions: { external: EXTERNAL },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(item => item.output);
  const chunk = outputs.find(item => item.type === 'chunk' && item.isEntry);
  if (!chunk) throw new Error('DSH client build produced no entry chunk');
  return `${HEADER}window.__ModuleLoader__.load({\n  id: 'dscord',\n  factory(require) {\n    const module = { exports: {} };\n    const exports = module.exports;\n${chunk.code.trim()}\n    return module.exports;\n  },\n});\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const design = await panelDesign();
  if (await readFile(designOutput, 'utf8').catch(() => '') !== design) await writeFile(designOutput, design);
  const text = await bundleDshClient();
  const previous = await readFile(clientOutput, 'utf8').catch(() => '');
  if (previous !== text) await writeFile(clientOutput, text);
  console.log(`dsh-connect/client.js ${previous === text ? 'unchanged' : 'written'} (${text.length} bytes)`);
}
