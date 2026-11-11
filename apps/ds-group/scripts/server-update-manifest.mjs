import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { packageRoot } from '../src/paths.mjs';
import { NODE_PROTOCOL } from '../src/node-protocol.mjs';
import { validateUpdateManifest } from '../src/server-update-release.mjs';

export function serverUpdateManifest({ version, image, policy, repository }) {
  return validateUpdateManifest({ schemaVersion: 1, version, image, ...policy, nodeProtocol: NODE_PROTOCOL }, { repository, version });
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const pkg = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  const policy = JSON.parse(await readFile(path.join(packageRoot, 'deploy/server-update-policy.json'), 'utf8'));
  const output = process.argv[2];
  if (!output) throw new Error('Specify the server-update.json output path');
  if (policy.enabled !== false) {
    const manifest = serverUpdateManifest({ version: pkg.version, image: process.env.DS_GROUP_RELEASE_IMAGE_REF,
      policy, repository: process.env.GITHUB_REPOSITORY });
    await writeFile(output, JSON.stringify(manifest, null, 2) + '\n');
  } else await rm(output, { force: true });
}
