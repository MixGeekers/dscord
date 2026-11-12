import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { packageRoot } from '../src/paths.mjs';

export async function checkDocuments({ root, files }) {
  let checked = 0;
  for (const file of files.filter(file => /\.md$/i.test(file))) {
    let text;
    try { text = await readFile(path.join(root, file), 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; } // Deleted documents need no link checks.
    const prose = text.replace(/^\s*(`{3,}|~{3,}).*\n[\s\S]*?^\s*\1\s*$/gm, '').replace(/`[^`\n]*`/g, '');
    const links = [...prose.matchAll(/\]\(<?([^\s)>]+)>?(?:\s+"[^"]*")?\)|\b(?:src|href)=["']([^"']+)["']/g)];
    for (const match of links) {
      const href = match[1] || match[2];
      if (/^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(href)) continue;
      const pathname = decodeURIComponent(href.split(/[?#]/)[0]);
      if (!pathname) continue;
      const destination = path.resolve(root, path.dirname(file), pathname);
      if (path.relative(root, destination).startsWith('..' + path.sep)) throw new Error(`${file}: link leaves the repository: ${href}`);
      try { await access(destination); }
      catch { throw new Error(`${file}: missing local link: ${href}`); }
    }
    checked++;
  }
  return { checked };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { files } = JSON.parse(await readFile(path.join(packageRoot, '.local/ci-scope.json'), 'utf8'));
  console.log(JSON.stringify(await checkDocuments({ root: path.resolve(packageRoot, '../..'), files })));
}
