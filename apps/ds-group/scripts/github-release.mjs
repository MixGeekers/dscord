import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { releaseMetadata } from './release-metadata.mjs';

const execute = promisify(execFile);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export async function publishGithubRelease({ directory, version, tag, repository, run = execute }) {
  const metadata = releaseMetadata({ version, tag, repository });
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries.map(entry => {
    if (!entry.isFile() || !/^[A-Za-z0-9._-]+$/.test(entry.name)) throw new Error('Unexpected GitHub release asset');
    return entry.name;
  }).sort();
  for (const required of [metadata.archive, metadata.npmArchive, 'release-manifest.json', 'SHA256SUMS', 'NPM-SHA256SUMS', 'image-index.json']) {
    if (!files.includes(required)) throw new Error(`Missing GitHub release asset: ${required}`);
  }
  const gh = args => run('gh', [...args, '--repo', repository], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
  const view = async () => JSON.parse((await gh(['release', 'view', tag, '--json', 'isDraft,url,assets'])).stdout);
  let release;
  try { release = await view(); }
  catch (error) {
    if (!/release not found|HTTP 404/i.test(error.stderr || error.message)) throw error;
  }
  const scratch = await mkdtemp(path.join(directory, '../github-release-'));
  try {
    if (!release) {
      const notes = path.join(scratch, 'notes.md');
      await writeFile(notes, `Container image \`${metadata.image}:${version}\` supports Linux amd64 and arm64.\n\n`
        + `Install \`dscord@${version}\` from npm, or download the same tested \`${metadata.npmArchive}\` below. `
        + 'Verify all downloaded assets with `SHA256SUMS`. The source archive includes `deploy/README.md`.\n\n'
        + 'The tag workflow verifies the source, npm installation, both container architectures, DSH runtime and Chromium before publication. '
        + 'CI uses synthetic accounts and local providers, with no remote model calls.\n');
      await gh(['release', 'create', tag, '--draft', '--verify-tag', '--title', `DSCord ${version}`, '--notes-file', notes,
        ...(metadata.prerelease === 'true' ? ['--prerelease'] : [])]);
      release = await view();
    }
    // Never clobber an asset for the same version. A failed upload can be resumed by adding only missing files.
    for (const filename of files) {
      if (!release.assets.some(asset => asset.name === filename)) await gh(['release', 'upload', tag, path.join(directory, filename)]);
      const download = path.join(scratch, filename + '.download');
      await mkdir(download);
      await gh(['release', 'download', tag, '--pattern', filename, '--dir', download]);
      if (hash(await readFile(path.join(directory, filename))) !== hash(await readFile(path.join(download, filename)))) {
        throw new Error(`Existing GitHub release asset differs: ${filename}; no assets were overwritten`);
      }
    }
    if (release.isDraft) await gh(['release', 'edit', tag, '--draft=false']);
    const result = await view();
    if (result.isDraft || files.some(filename => !result.assets.some(asset => asset.name === filename))) {
      throw new Error('GitHub release is incomplete after publication');
    }
    return { url: result.url, assets: files, resumed: Boolean(release.assets.length) };
  } finally { await rm(scratch, { recursive: true, force: true }); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const result = await publishGithubRelease({ directory: path.resolve('release'), version: process.env.VERSION,
    tag: process.env.RELEASE_TAG, repository: process.env.GITHUB_REPOSITORY });
  console.log(JSON.stringify(result, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
    `### GitHub Release\n\n[Published release](${result.url})\n\n${result.assets.map(file => `- ${file}: SHA-256 verified`).join('\n')}\n`);
}
