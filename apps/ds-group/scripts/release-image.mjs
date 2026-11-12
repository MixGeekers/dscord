import { execFile } from 'node:child_process';
import { appendFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { releaseMetadata } from './release-metadata.mjs';

const execute = promisify(execFile);

export function verifyImageIndex(index, expected) {
  const manifests = index.manifests || [];
  for (const arch of ['amd64', 'arm64']) {
    if (manifests.filter(item => item.platform?.os === 'linux' && item.platform?.architecture === arch).length !== 1) {
      throw new Error(`Image index must contain exactly one Linux ${arch} image`);
    }
  }
  if (expected && JSON.stringify(manifests.map(item => item.digest).sort()) !== JSON.stringify(expected.map(item => item.digest).sort())) {
    throw new Error('Existing image tag differs from the verified image digests; no tag was overwritten');
  }
}

export async function publishImageIndex({ image, version, directory, output, run = execute }) {
  const digests = (await readdir(directory)).sort();
  if (digests.length !== 2 || digests.some(digest => !/^[a-f0-9]{64}$/.test(digest))) throw new Error('Expected two immutable image digests');
  const docker = args => run('docker', ['buildx', 'imagetools', ...args], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
  const inspect = async reference => JSON.parse((await docker(['inspect', reference, '--raw'])).stdout);
  const expected = [];
  for (const digest of digests) {
    const candidate = await inspect(`${image}@sha256:${digest}`);
    // BuildKit provenance/SBOM make each single-architecture candidate an index of image + attestations.
    if (!Array.isArray(candidate.manifests)) throw new Error('Published architecture lacks its provenance index');
    expected.push(...candidate.manifests);
  }
  verifyImageIndex({ manifests: expected });
  const reference = `${image}:${version}`;
  let index;
  try { index = await inspect(reference); }
  catch (error) {
    if (!/manifest unknown|not found|no such manifest/i.test(error.stderr || error.message)) throw error;
  }
  const alreadyPublished = Boolean(index);
  if (index) verifyImageIndex(index, expected);
  else {
    await docker(['create', '--tag', reference, ...digests.map(digest => `${image}@sha256:${digest}`)]);
    index = await inspect(reference);
    verifyImageIndex(index, expected);
  }
  await writeFile(output, JSON.stringify(index, null, 2) + '\n');
  const digest = (await docker(['inspect', reference, '--format', '{{.Manifest.Digest}}'])).stdout.trim();
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error('Invalid published image index digest');
  return { reference: `${image}@${digest}`, alreadyPublished };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const metadata = releaseMetadata({ version: process.env.VERSION, tag: process.env.RELEASE_TAG, repository: process.env.GITHUB_REPOSITORY });
  const result = await publishImageIndex({ image: metadata.image, version: metadata.version,
    directory: path.join(process.env.RUNNER_TEMP, 'digests'), output: path.resolve('release/image-index.json') });
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `reference=${result.reference}\n`);
  console.log(JSON.stringify(result, null, 2));
}
