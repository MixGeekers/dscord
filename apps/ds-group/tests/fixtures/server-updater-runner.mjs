// Synthetic release source for the real Docker smoke. Never used by production entrypoints.
import { readFile } from 'node:fs/promises';
import { ServerUpdater } from '/app/src/server-updater.mjs';
import { UpdateDocker } from '/app/src/server-update-docker.mjs';
import { serveUpdater } from '/app/scripts/server-updater.mjs';
const engine = new UpdateDocker();
engine.pull = image => engine.request('GET', `/images/${encodeURIComponent(image)}/json`);
const replace = engine.replace.bind(engine);
engine.replace = async (...args) => {
  const id = await replace(...args);
  const feed = JSON.parse(await readFile('/fixtures/feed.json', 'utf8'));
  if (feed.pauseAfterCreate) await new Promise(() => {});
  return id;
};
const releases = { async check({ currentVersion }) {
  const feed = JSON.parse(await readFile('/fixtures/feed.json', 'utf8'));
  return feed.target?.version !== currentVersion ? feed.target : null;
} };
const updater = new ServerUpdater({ engine, releases, readyTimeout: 20000, drainTimeout: 10000 });
await serveUpdater(updater, { initialize: true });
