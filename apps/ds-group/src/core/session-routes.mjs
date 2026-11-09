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
  const { setup, accounts, identity, media, nativeBots, push, governance, invites } = app;

  router.get('/healthz', ({ send }) => send(200, { status: 'ok' }));
  router.get('/readyz', async ({ send }) => {
    try {
      const upstream = await fetch(new URL('/_matrix/client/versions', setup.homeserverUrl), { signal: AbortSignal.timeout(3000) });
      const versions = await upstream.json();
      if (!upstream.ok || !Array.isArray(versions.versions)) throw new Error('Matrix is unavailable');
      return send(200, { status: 'ready', matrix: 'ready' });
    } catch { return send(503, { status: 'unavailable', matrix: 'unavailable' }); }
  });

  router.get('/api/bootstrap', async ({ response, send }) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    const discovery = await app.discovery();
    send(200, { name: 'DSCord', serverName: setup.serverName, roomId: setup.roomId, homeserverUrl: setup.publicHomeserverUrl || setup.homeserverUrl,
      participants: accounts.publicParticipants(), nodes: app.nodeSnapshot(), attachments: { maxBytes: media.maxBytes, maxPerMessage: MAX_ATTACHMENTS },
      identity: discovery, web: { mode: app.webMode } });
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
    // A server that only takes invited people lets a new person in with an invitation, and a new Bot when its owner is a member.
    const admit = async () => {
      const { directory } = await governance.read();
      if (directory.join !== 'invite') return;
      if (claims.kind !== 'bot') return invites.redeem(input.inviteCode);
      if (accounts.row(ownerId)?.status !== 'active') throw Object.assign(new Error('INVITE_REQUIRED'), { status: 403, code: 'INVITE_REQUIRED' });
    };
    send(200, await accounts.signIn(claims, { ownerId, admit, clientIp: clientIp(request, app.trustProxy) }));
  });
  // Members invite people; an invitation is shared as a code or a link with ?invite=CODE.
  router.post('/api/invites', ({ userId, send }) => send(201, { invite: invites.create(accounts.human(userId).id) }));
  router.get('/api/invites', ({ userId, send }) => send(200, { invites: invites.list(accounts.human(userId).id) }));
  router.delete(/^\/api\/invites\/([^/]+)$/, ({ userId, send }, code) => {
    invites.revoke(code, accounts.human(userId).id);
    send(200, { revoked: true });
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
