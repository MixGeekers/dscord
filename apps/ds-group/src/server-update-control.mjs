import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';

export const updateControlRoot = () => process.env.DS_GROUP_UPDATE_CONTROL_DIR || '';
export async function maintenance(root = updateControlRoot()) {
  if (!root) return null;
  try { return JSON.parse(await readFile(path.join(root, 'maintenance.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export async function authorizeUpdater(request, root = updateControlRoot()) {
  if (!root) return false;
  const expected = await readFile(path.join(root, 'token'), 'utf8');
  const supplied = String(request.headers.authorization || '').replace(/^Bearer /, '');
  const a = Buffer.from(expected.trim()), b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Only administration proxies this local socket. No browser-supplied URL, command or image is forwarded. */
export function updaterRequest(route, body, root = updateControlRoot()) {
  if (!root) return Promise.resolve({ enabled: false });
  return new Promise((resolve, reject) => {
    const request = http.request({ socketPath: path.join(root, 'updater.sock'), path: route,
      method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 55000 }, response => {
      let data = '';
      response.on('data', chunk => { data += chunk; if (data.length > 1024 * 1024) request.destroy(new Error('Updater response too large')); });
      response.on('end', () => {
        try {
          const value = JSON.parse(data);
          if (response.statusCode >= 400) reject(Object.assign(new Error(value.error || 'Updater request failed'), { status: response.statusCode }));
          else resolve(value);
        } catch (error) { reject(error); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Updater request timed out')));
    request.on('error', error => reject(Object.assign(new Error('Server updater is unavailable'), { status: 503, cause: error })));
    request.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
