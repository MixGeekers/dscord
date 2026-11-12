import { execFile } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { packageRoot } from '../src/paths.mjs';

const execute = promisify(execFile);
const prefix = 'apps/ds-group/';

export function classifyChanges(files, { full = false } = {}) {
  const scope = { code: full, browser: full, runtime: full, deploy: full, packaging: full, docs: false };
  const all = () => { for (const key of ['code', 'browser', 'runtime', 'deploy', 'packaging']) scope[key] = true; };
  for (const filename of files) {
    // Runtime skills and test fixtures are executable inputs, even when written in Markdown.
    const documentation = /\.md$/i.test(filename) && !/\/(?:skills|fixtures)\//.test(filename);
    if (documentation) { scope.docs = true; continue; }
    if (filename.startsWith('.github/')) { all(); continue; }
    if (!filename.startsWith(prefix)) continue;
    const file = filename.slice(prefix.length);
    if (file.startsWith('assets/')) continue; // README illustrations are not application inputs.
    scope.code = true;
    if (/^(?:package(?:-lock)?\.json|scripts\/ci-[^/]+\.mjs)$/.test(file)) { all(); continue; }
    if (/^(?:web\/|admin\/|ui\/|dsh-connect\/client(?:\/|\.js$)|vite\.config|tsconfig)/.test(file)
      || /(?:\.browser\.mjs$|^tests\/helpers\/)/.test(file)
      || /^scripts\/build-/.test(file)) scope.browser = true;
    if (/^(?:memory\/|service\/|dsh-plugin\/|vendor\/|cordis\.patch\.yml$)/.test(file)
      || (file.startsWith('dsh-connect/') && !/^dsh-connect\/client(?:\/|\.js$)/.test(file))
      || /^src\/(?:native|node[.-]|bot-node|front-prompt|decision|model-|message-context|file-|work-|home-lock)/.test(file)
      || /^scripts\/(?:.*runtime|dsh-|verification-model)/.test(file)
      || /(?:\.(?:host|runtime)\.mjs$|^tests\/fixtures\/)/.test(file)) scope.runtime = true;
    if (/^(?:deploy\/|Dockerfile$|\.dockerignore$|central\/)/.test(file)
      || /^src\/(?:core\.|admin\.|identity\.|central-trust\.|web-mode\.|server-|storage)/.test(file)
      || /^scripts\/(?:deploy-|platform-deploy-|server-|matrix\.|service\.)/.test(file)) scope.deploy = true;
    if (/^(?:bin\/|LICENSE|LICENCE|NOTICE)/.test(file)
      || /^scripts\/(?:release-|npm-|build-|runtime-dependencies)/.test(file)) scope.packaging = true;
  }
  return scope;
}

export async function changedFiles({ root, event, eventName, sha, run = execute }) {
  const base = eventName === 'pull_request' ? event.pull_request?.base?.sha : event.before;
  const head = eventName === 'pull_request' ? event.pull_request?.head?.sha : sha;
  if (eventName === 'workflow_dispatch' || !/^[a-f0-9]{40}$/.test(base || '')
    || /^0+$/.test(base) || !/^[a-f0-9]{40}$/.test(head || '')) return { files: [], full: true };
  // Include both sides of renames so moving a file out of a sensitive directory still runs its checks.
  const range = eventName === 'pull_request' ? [`${base}...${head}`] : [base, head];
  const { stdout } = await run('git', ['diff', '--name-only', '--no-renames', '-z', ...range, '--'], { cwd: root, maxBuffer: 8 * 1024 * 1024 });
  return { files: stdout.split('\0').filter(Boolean), full: false };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const root = path.resolve(packageRoot, '../..');
  const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8')) : {};
  const changes = await changedFiles({ root, event, eventName: process.env.GITHUB_EVENT_NAME, sha: process.env.GITHUB_SHA });
  const scope = classifyChanges(changes.files, changes);
  await mkdir(path.join(packageRoot, '.local'), { recursive: true });
  await writeFile(path.join(packageRoot, '.local/ci-scope.json'), JSON.stringify({ ...changes, scope }, null, 2) + '\n');
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT,
    Object.entries(scope).map(([key, value]) => `${key}=${value}\n`).join(''));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
    `### Checks for this change\n\n${Object.entries(scope).map(([key, value]) => `- ${key}: ${value ? 'run' : 'skip'}`).join('\n')}\n`);
  console.log(JSON.stringify({ files: changes.files, ...scope }, null, 2));
}
