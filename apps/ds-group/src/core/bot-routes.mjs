import { nodeBundle } from '../../scripts/server-admin.mjs';

export function botRoutes(router, app) {
  const { setup, config, accounts, nativeBots, nodeCredentials } = app;
  const withBinding = (userId, bot) => ({ ...bot, nativeBinding: nativeBots.bindings(userId).find(binding => binding.botId === bot.id) ?? null });

  // Bot management is for home human accounts; accounts.human throws for anyone else.
  router.get('/api/bot-catalog', ({ userId, send }) => { accounts.human(userId); send(200, { bots: nativeBots.list(userId) }); });
  router.post('/api/bot-catalog', async ({ userId, body, send }) => { accounts.human(userId); send(200, nativeBots.publish(userId, await body())); });
  router.post('/api/bots/attach', async ({ userId, body, send }) => {
    accounts.human(userId);
    const bot = await nativeBots.attach(userId, await body());
    send(200, { bot: withBinding(userId, bot) });
  });
  router.post('/api/bots', async ({ userId, body, send }) => {
    accounts.human(userId);
    send(201, { bot: await accounts.createBot(userId, await body()) });
  });
  for (const path of ['/api/bots', '/api/my-bots']) {
    router.get(path, ({ userId, send }) => send(200, {
      bots: app.publicParticipants().filter(person => person.kind === 'bot' && person.ownerId === userId).map(bot => withBinding(userId, bot)),
    }));
  }
  router.post(/^\/api\/bots\/([^/]+)\/connect$/, async ({ userId, send }, botId) => {
    accounts.human(userId);
    const bot = accounts.person(botId);
    if (!bot || bot.kind !== 'bot' || bot.ownerId !== userId) return send(403, { error: 'Choose one of your own Bots' });
    const bundle = nodeBundle(setup, { ...config, nodeSecret: await nodeCredentials.issue(bot) }, bot.localpart);
    const nativeBinding = nativeBots.bindings(userId).find(binding => binding.botId === bot.id);
    if (nativeBots.isNative(bot.id) && nativeBinding) {
      bundle.coreConfig.executionMode = 'native';
      bundle.coreConfig.nativeBinding = nativeBinding;
      bundle.setup.participants.find(person => person.id === bot.id).nativeBinding = nativeBinding;
    }
    send(200, { bundle });
  });
}
