import { requireNodeScope } from '../node-auth.mjs';
import { publicKernelSummary } from '../kernel-control.mjs';
import { HELLO_PATH, NODE_PROTOCOL, accepts, answerHello, parseHello } from '../node-protocol.mjs';

export const NODE_OFFLINE_MS = 20000;
const NODE_STATUSES = new Set(['idle', 'thinking', 'error', 'offline']);
const shortId = value => typeof value === 'string' && value.length > 0 && value.length <= 200 && !value.includes('\0');

// Bot-node endpoints. Every request carries a node credential checked before the route runs.
export function nodeRoutes(router, app) {
  const { accounts, budget, nodes, kernelControl, chatFeatures } = app;

  router.post('/internal/model/claim', async ({ scope, body, send }) => {
    const input = await body();
    requireNodeScope(scope, { nodeId: input.nodeId });
    send(200, budget.claim(input));
  });
  router.post('/internal/model/complete', async ({ scope, body, send }) => send(200, budget.complete(await body(), scope || {})));
  // The protocol handshake. Its request and answer only ever gain fields, so every
  // kernel, however old, can learn which protocol this server speaks.
  router.post(HELLO_PATH, async ({ scope, body, send }) => {
    const input = parseHello(await body());
    if (!input) return send(400, { error: 'Invalid node hello', code: 'HELLO_INVALID' });
    requireNodeScope(scope, { botId: input.botId, nodeId: input.nodeId });
    const answer = answerHello(input);
    send(answer.status, answer.body);
  });
  router.post('/internal/nodes/heartbeat', async ({ scope, body, send }) => {
    const input = await body();
    requireNodeScope(scope, { botId: input.botId, nodeId: input.id });
    if (!accepts(NODE_PROTOCOL, input.protocol)) {
      return send(426, { code: 'PROTOCOL_UPGRADE_REQUIRED', error: 'This kernel does not speak the server protocol', protocol: NODE_PROTOCOL });
    }
    const participant = accounts.publicParticipants().find(p => p.id === input.botId && p.kind === 'bot');
    if (!participant || !shortId(input.id) || !shortId(input.runtimeId) || !NODE_STATUSES.has(input.status)) return send(400, { error: 'Invalid Bot node heartbeat' });
    const current = nodes.get(input.botId);
    if (current && current.status !== 'offline' && (current.id !== input.id || current.runtimeId !== input.runtimeId) && Date.now() - current.heartbeatAt < NODE_OFFLINE_MS) {
      return send(409, { error: 'Node already has an active runtime' });
    }
    nodes.set(input.botId, { id: input.id, botId: input.botId, name: participant.name, runtimeId: input.runtimeId,
      status: input.status, processed: input.processed ?? 0, pending: input.pending ?? 0,
      sessionId: input.sessionId ?? null, lastError: input.lastError ?? null,
      model: typeof input.model === 'string' ? input.model.slice(0, 512) : null,
      engine: input.engine || 'DSCord node', heartbeatAt: Date.now(), kernel: publicKernelSummary(input.kernel),
      protocol: typeof input.protocol === 'string' ? input.protocol : null,
      kernelVersion: typeof input.kernelVersion === 'string' ? input.kernelVersion.slice(0, 64) : null,
      maintenanceId: typeof input.maintenanceId === 'string' ? input.maintenanceId.slice(0, 64) : null,
      maintenanceBusy: input.maintenanceBusy !== false,
      pendingUpdates: Number.isSafeInteger(input.pendingUpdates) ? input.pendingUpdates : 0,
      kernelControl: input.kernelControl?.version === 1 ? { version: 1 } : null });
    kernelControl.observeNode(input.botId);
    chatFeatures.touchPresence(input.botId, { status: input.status === 'offline' ? 'offline' : 'online' });
    send(200, { accepted: true, maintenance: await app.updateMaintenance?.() || null });
  });
}

export function pushRoutes(router, app) {
  const { push } = app;
  const recipient = (userId, send) => {
    if (!push) { send(503, { error: 'Notifications are not enabled' }); return false; }
    if (app.publicParticipants().some(p => p.id === userId && p.kind === 'human')) return true;
    send(403, { error: 'Choose a human notification recipient' });
    return false;
  };
  router.get('/api/push/subscriptions', async ({ userId, send }) => recipient(userId, send) && send(200, { subscriptions: await push.subscriptions(userId) }));
  router.post('/api/push/subscriptions', async ({ userId, body, send }) => recipient(userId, send) && send(200, await push.subscribe(userId, await body())));
  router.delete('/api/push/subscriptions', async ({ userId, body, send }) => recipient(userId, send) && send(200, await push.unsubscribe(userId, (await body()).endpoint)));
  router.post('/api/push/test', async ({ userId, send }) => recipient(userId, send) && send(200, await push.sendTest(userId)));
}
