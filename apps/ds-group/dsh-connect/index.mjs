import path from 'node:path';
import { homedir } from 'node:os';
import { ConnectController } from './controller.mjs';
import { NativeBots } from './native-bots.mjs';
import { NativeConnections } from './native-connections.mjs';
import { startNativeTeam } from './native-team.mjs';
import { KernelUpdates } from './kernel-updates.mjs';

export const name = 'dscord-connect';
export const inject = ['connection', 'profileContext', 'llm', 'settings', 'credentials', 'sessionController', 'sessions', 'tools', 'systemPrompt', 'sessionTitle', 'workspaceRegistry'];

export async function apply(ctx, config = {}) {
  const sourceHome = path.resolve(process.env.DSH_HOME || path.join(homedir(), '.dsh'));
  const sourceProfile = ctx.profileContext?.name || 'desktop';
  const directory = path.resolve(config.dataDirectory || path.join(sourceHome, 'dscord', sourceProfile));
  const native = new NativeBots(ctx, { ensureTeam: () => startNativeTeam(ctx, { home: config.kernelHome }) });
  let processes;
  const updates = await new KernelUpdates({ ctx, directory, isIdle: () => processes?.idle() ?? true }).initialize();
  ctx.effect(() => () => updates.dispose(), 'dscord: kernel update checks');
  processes = new NativeConnections({ ctx, native, updates });
  const controller = new ConnectController({ directory, native, processes, updates });
  const ready = controller.initialize();
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/dscord', methods: ['POST'], requestBody: 'buffered',
    async fetch(request) {
      let result;
      try {
        const body = await request.json();
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('请求格式无效');
        await ready;
        result = { ok: true, value: await controller.handle(body) };
      } catch (error) {
        result = { ok: false, error: { code: error.code || 'dscord/error', message: error.message, details: error.details || {} } };
      }
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    },
  }), 'dscord: connection API');
  ctx.effect(() => () => controller.dispose(), 'dscord: owned Bot processes');
  await ready;
  // Every few seconds this device reports to the central server and follows the Bot setup it is given.
  void controller.synchronize().catch(() => {});
  const timer = setInterval(() => void controller.synchronize().catch(() => {}), 5000);
  ctx.effect(() => () => clearInterval(timer), 'dscord: central report');
}
