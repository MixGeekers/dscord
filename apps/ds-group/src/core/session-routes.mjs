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
      participants: accounts.publicParticipants(), nodes: app.nodeSnapshot(), attachments: { maxBytes: media.maxBytes, maxPerMessage: MAX_ATTACHMENTS },
      identity: identity.discovery(), web: { mode: app.webMode } });
  });
  router.get('/api/status', ({ send }) => send(200, { nodes: app.nodeSnapshot(), budget: app.budget.snapshot(),
    core: { startedAt: app.startedAt, storage: 'Matrix Synapse', roomId: setup.roomId, webMode: app.webMode, nodeProtocol: NODE_PROTOCOL } }));
  router.get('/api/push/config', async ({ send }) => send(200, push ? await push.getConfig() : { enabled: false, requiresSecureContext: true }));

  // The one way to sign in, for people and Bots alike: an identity token the central server issued for this server.
  router.post('/api/session', async ({ request, body, send }) => {
    const trust = identity.trust();
    const input = await body();
    const claims = await trust.verify(input.identityToken);
    const ownerId = claims.kind === 'bot' ? trust.localUser(claims.owner, setup.serverName) : null;
    send(200, await accounts.signIn(claims, { ownerId, clientIp: clientIp(request, app.trustProxy) }));
  });
  router.post('/api/logout', async ({ token, send }) => send(200, await accounts.logout(token())));
  router.get('/api/me', async ({ token, send }) => {
    const profile = await accounts.me(token());
    send(200, { ...profile, ownedBots: profile.ownedBots.map(bot => {
      const nativeBinding = nativeBots.binding(bot.id);
      return nativeBinding ? { ...bot, nativeBinding } : bot;
    }) });
  });
}
