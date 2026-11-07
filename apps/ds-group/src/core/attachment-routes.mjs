import { serverOf } from '../governance.mjs';

export function attachmentRoutes(router, app) {
  const { setup, accounts, media, attachmentAccess } = app;
  const member = (userId, send) => {
    if (app.publicParticipants().some(person => person.id === userId)) return true;
    send(403, { error: 'A registered member is required' });
    return false;
  };

  router.get(/^\/api\/rooms\/([^/]+)\/attachments\/([^/]+)(\/metadata)?$/, async ({ request, response, url, userId, client, send }, roomId, attachmentId, metadata) => {
    if (serverOf(userId) !== setup.serverName || accounts.row(userId)?.status !== 'active') return send(403, { error: 'An active home identity is required' });
    const matrix = client();
    const proven = await attachmentAccess.prove({ client: matrix, userId, roomId, attachmentId, eventId: url.searchParams.get('eventId') });
    if (metadata) return send(200, proven);
    return media.download({ verifiedAttachment: proven.attachment, client: matrix, request, response, asDownload: url.searchParams.get('download') === '1',
      authorize: async () => {
        if (accounts.row(userId)?.status !== 'active') throw Object.assign(new Error('An active home identity is required'), { status: 403 });
        await attachmentAccess.prove({ client: matrix, userId, roomId: proven.proof.roomId, eventId: proven.proof.eventId, attachmentId: proven.attachment.id });
      } });
  });

  router.post('/api/attachments', async ({ request, response, url, userId, client, send }) => {
    if (!member(userId, send)) return;
    const controller = new AbortController();
    const disconnected = () => { if (!response.writableFinished) controller.abort(); };
    response.once('close', disconnected);
    try {
      send(200, { attachment: await media.upload({ request, filename: url.searchParams.get('filename'), ownerId: userId, client: client(), signal: controller.signal }) });
    } finally { response.off('close', disconnected); }
  });

  router.get(/^\/api\/attachments\/([^/]+)(\/metadata)?$/, async ({ request, response, url, userId, client, send }, id, metadata) => {
    if (!member(userId, send)) return;
    const matrix = client();
    const source = url.searchParams.has('roomId') || url.searchParams.has('eventId')
      ? { roomId: url.searchParams.get('roomId'), eventId: url.searchParams.get('eventId') } : undefined;
    const authorized = await attachmentAccess.local({ client: matrix, userId, id, source });
    if (metadata) return send(200, { attachment: authorized });
    return media.download({ verifiedAttachment: authorized, client: matrix, request, response, asDownload: url.searchParams.get('download') === '1',
      authorize: () => attachmentAccess.local({ client: matrix, userId, id, source }) });
  });
}
