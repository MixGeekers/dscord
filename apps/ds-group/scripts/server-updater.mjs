#!/usr/bin/env node
import http from 'node:http';
import path from 'node:path';
import { chmod, chown, mkdir, rm, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { ServerUpdater } from '../src/server-updater.mjs';
import { readJsonBody } from '../src/http-json.mjs';

export async function serveUpdater(updater, { initialize = false } = {}) {
  await mkdir(updater.control, { recursive: true, mode: 0o750 });
  const socket = path.join(updater.control, 'updater.sock');
  // Do not unlink a socket owned by a live updater.
  try {
    await stat(socket);
    const live = await new Promise(resolve => {
      const request = http.get({ socketPath: socket, path: '/status', timeout: 1000 }, response => { response.resume(); resolve(true); });
      request.on('error', () => resolve(false));
      request.on('timeout', () => { request.destroy(); resolve(true); });
    });
    if (live) throw new Error('An updater is already running');
    await rm(socket);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  let ready = !initialize;
  const server = http.createServer((request, response) => {
    const send = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
    (async () => {
      if (!ready) return send(503, { error: 'Updater is recovering its previous transaction' });
      if (request.url === '/status' && request.method === 'GET') return send(200, updater.view());
      if (request.method !== 'POST') return send(404, { error: 'Unknown updater operation' });
      const input = await readJsonBody(request);
      if (request.url === '/check') return send(200, await updater.check());
      if (request.url === '/settings') return send(200, await updater.configure(input));
      if (request.url === '/apply') return send(202, await updater.apply(input.version));
      if (request.url === '/recover') return send(202, await updater.recover());
      send(404, { error: 'Unknown updater operation' });
    })().catch(error => send(error.status || 500, { error: String(error.message).slice(0, 500) }));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(socket, resolve); });
  await chmod(socket, 0o660);
  if (process.getuid?.() === 0) await chown(socket, 0, 1000);
  if (initialize) {
    try { await updater.initialize(); ready = true; }
    catch (error) { await new Promise(resolve => server.close(resolve)); throw error; }
  }
  const timer = setInterval(() => void updater.tick().catch(() => {}), 60000);
  const startup = setTimeout(() => void updater.tick().catch(() => {}), 15000);
  const close = () => { clearInterval(timer); clearTimeout(startup); return new Promise(resolve => server.close(resolve)); };
  return { server, close };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const updater = new ServerUpdater();
  await serveUpdater(updater, { initialize: true });
  // Docker may restart the updater while a job is in progress. The durable transaction is recovered on boot.
}
