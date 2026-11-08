import { nodeBundle } from '../../scripts/server-admin.mjs';

export function botRoutes(router, app) {
  const { setup, config, accounts, nativeBots, nodeCredentials } = app;
  const withBinding = bot => ({ ...bot, nativeBinding: nativeBots.binding(bot.id) });

  for (const path of ['/api/bots', '/api/my-bots']) {
    router.get(path, ({ userId, send }) => send(200, {
      bots: app.publicParticipants().filter(person => person.kind === 'bot' && person.ownerId === userId).map(withBinding),
    }));
  }
  // A Bot fetches its own node configuration after signing in with its central identity.
  router.post(/^\/api\/bots\/([^/]+)\/connect$/, async ({ userId, body, send }, botId) => {
    const bot = accounts.person(botId);
    if (!bot || bot.kind !== 'bot' || userId !== bot.id) return send(403, { error: 'A Bot connects its own node', code: 'BOT_SESSION_REQUIRED' });
    const nativeBinding = nativeBots.report(bot.id, (await body()).native);
    const bundle = nodeBundle(setup, { ...config, nodeSecret: await nodeCredentials.issue(bot) }, bot.localpart);
    if (nativeBinding) {
      bundle.coreConfig.executionMode = 'native';
      bundle.coreConfig.nativeBinding = nativeBinding;
      bundle.setup.participants.find(person => person.id === bot.id).nativeBinding = nativeBinding;
    }
    send(200, { bundle });
  });
}
