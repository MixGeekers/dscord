import { isIP } from 'node:net';
import { MAX_ATTACHMENTS } from '../media.mjs';
import { NODE_PROTOCOL } from '../node-protocol.mjs';

function clientIp(request, trustProxy) {
  const forwarded = request.headers['x-forwarded-for'];
  if (trustProxy && typeof forwarded === 'string') {
    const address = forwarded.split(',').at(-1).trim();
    if (isIP(address)) return address;
  }
  const address = request.socket.remoteAddress;
  return isIP(address || '') ? address : undefined;
}

export function sessionRoutes(router, app) {
  const { setup, accounts, identity, media, nativeBots, push } = app;

  router.get('/healthz', ({ send }) => send(200, { status: 'ok' }));
  router.get('/readyz', async ({ send }) => {
    try {
      const upstream = await fetch(new URL('/_matrix/client/versions', setup.homeserverUrl), { signal: AbortSignal.timeout(3000) });
      const versions = await upstream.json();
      if (!upstream.ok || !Array.isArray(versions.versions)) throw new Error('Matrix is unavailable');
      return send(200, { status: 'ready', matrix: 'ready' });
    } catch { return send(503, { status: 'unavailable', matrix: 'unavailable' }); }
  });

  router.get('/api/bootstrap', ({ response, send }) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    send(200, { name: 'DSCord', serverName: setup.serverName, roomId: setup.roomId, homeserverUrl: setup.publicHomeserverUrl || setup.homeserverUrl,
      participants: accounts.publicParticipants(), nodes: app.nodeSnapshot(), demoLogin: app.demoLogin, mode: app.demoLogin ? 'local-synthetic-demo' : 'server',
      registration: accounts.registration(), attachments: { maxBytes: media.maxBytes, maxPerMessage: MAX_ATTACHMENTS },
      identity: identity.discovery(), web: { mode: app.webMode } });
  });
  router.get('/api/status', ({ send }) => send(200, { nodes: app.nodeSnapshot(), budget: app.budget.snapshot(),
    core: { startedAt: app.startedAt, storage: 'Matrix Synapse', roomId: setup.roomId, webMode: app.webMode, nodeProtocol: NODE_PROTOCOL } }));
  router.get('/api/push/config', async ({ send }) => send(200, push ? await push.getConfig() : { enabled: false, requiresSecureContext: true }));

  router.get('/api/demo-login', ({ url, send }) => {
    if (!app.demoLogin) return send(404, { error: 'Demo login is disabled' });
    const user = url.searchParams.get('user');
    const participant = setup.participants.find(p => p.kind === 'human' && (p.localpart === user || p.id === user));
    if (!participant) return send(404, { error: 'Unknown demo human' });
    send(200, { access_token: participant.accessToken, user_id: participant.id, mode: 'synthetic-demo-account' });
  });
  router.post('/api/login', async ({ request, body, send }) =>
    send(200, await accounts.login(await body(), { clientIp: clientIp(request, app.trustProxy) })));
  router.post('/api/register', async ({ request, body, send }) =>
    send(201, await accounts.register(await body(), { clientIp: clientIp(request, app.trustProxy) })));
  router.post('/api/logout', async ({ token, send }) => send(200, await accounts.logout(token())));
  router.get('/api/me', async ({ token, send }) => {
    const profile = await accounts.me(token());
    const bindings = nativeBots.bindings(profile.user.id);
    send(200, { ...profile, ownedBots: profile.ownedBots.map(bot => {
      const nativeBinding = bindings.find(binding => binding.botId === bot.id);
      return nativeBinding ? { ...bot, nativeBinding } : bot;
    }) });
  });
}
