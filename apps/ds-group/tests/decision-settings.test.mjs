import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { DecisionSettings } from '../dsh-connect/decision-settings.mjs';
import { NativeConnections } from '../dsh-connect/native-connections.mjs';
import { createOpenAIDecisionProvider, DECISION_DEFAULTS } from '../src/decision-provider.mjs';

test('private decision configuration survives restart without returning the credential', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dscord-decision-setting-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const received = [];
  const providerFactory = ({ apiKey }) => {
    received.push(apiKey);
    return { model: 'gpt-6-luna', health: () => ({ health: 'unknown' }) };
  };
  const settings = await new DecisionSettings({ directory, environment: {}, providerFactory }).initialize();
  assert.equal(settings.publicStatus().configured, false);
  const result = await settings.save({ apiKey: 'synthetic-private-decision-key' });
  assert.equal(result.configured, true);
  assert.equal(result.available, null);
  assert.equal(JSON.stringify(result).includes('synthetic-private'), false);
  assert.equal((await stat(settings.filename)).mode & 0o777, 0o600);
  await settings.save({ apiKey: '', enabled: false });
  const restored = await new DecisionSettings({ directory, environment: {}, providerFactory }).initialize();
  assert.equal(restored.provider, null);
  assert.equal(restored.publicStatus().configured, true);
  await restored.save({ enabled: true });
  assert.equal(received.at(-1), 'synthetic-private-decision-key');
  assert.equal(JSON.parse(await readFile(settings.filename, 'utf8')).enabled, true);
});

test('private Decisions routing overrides its environment and persists without changing credential compatibility', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dscord-decision-route-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const received = [];
  const providerFactory = options => { received.push(options); return { model: options.model }; };
  const environment = { OPENAI_API_KEY: 'synthetic-generic-key', DSCORD_DECISION_MODEL: 'proxy/decision-v1',
    DSCORD_DECISION_ENDPOINT: 'http://127.0.0.1:9417/v1/decisions' };
  const settings = await new DecisionSettings({ directory, environment, providerFactory }).initialize();
  assert.deepEqual(received[0], { apiKey: 'synthetic-generic-key', model: environment.DSCORD_DECISION_MODEL, endpoint: environment.DSCORD_DECISION_ENDPOINT });
  const status = await settings.save({ model: 'private/decision-v2', endpoint: 'https://decision.example/v2/decisions' });
  assert.equal(status.model, 'private/decision-v2');
  assert.equal(JSON.stringify(status).includes('synthetic-generic-key'), false);
  assert.equal(JSON.stringify(status).includes('decision.example'), false);
  const restored = await new DecisionSettings({ directory, environment, providerFactory }).initialize();
  assert.equal(restored.publicStatus().model, 'private/decision-v2');
  assert.equal(received.at(-1).endpoint, 'https://decision.example/v2/decisions');
  const before = await readFile(settings.filename, 'utf8');
  await assert.rejects(settings.save({ endpoint: 'file:///tmp/decisions' }), { code: 'INVALID_DECISION_ENDPOINT' });
  assert.equal(await readFile(settings.filename, 'utf8'), before);
});

test('saving asks the service one question, so the status says whether the settings work and why not', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dscord-decision-verify-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const asked = [];
  let reply = () => new Response('{}', { status: 401 });
  const fetchImpl = async (url, options) => { asked.push({ url, body: JSON.parse(options.body), key: options.headers.Authorization }); return reply(); };
  const decisionSettings = await new DecisionSettings({ directory, environment: {},
    providerFactory: options => createOpenAIDecisionProvider({ ...options, fetchImpl }) }).initialize();
  const connections = new NativeConnections({ ctx: {}, native: { info: async () => ({ runtime: { id: 'dscord-kernel' } }) }, decisionSettings });

  assert.deepEqual((await connections.kernelState()).decisionForm, { enabled: true, hasKey: false, ...DECISION_DEFAULTS });
  const refused = await connections.saveDecisionProvider({ apiKey: 'synthetic-private-decision-key', enabled: true });
  assert.deepEqual([refused.configured, refused.available, refused.error], [true, false, 'ATTENTION_HTTP_401']);
  assert.equal(asked.length, 1);
  assert.deepEqual([asked[0].url, asked[0].key, asked[0].body.model], [DECISION_DEFAULTS.endpoint, 'Bearer synthetic-private-decision-key', DECISION_DEFAULTS.model]);
  assert.equal(asked[0].body.questions[0].name, 'turn_taking');
  assert.equal(JSON.parse(asked[0].body.input).self.id, 'dscord-check', 'the question carries nothing of the owner\'s');

  // The model and address are filled in from the panel; an answer from that model makes the status real.
  reply = () => Response.json({ model: 'company/decision-v2', answers: [{ name: 'turn_taking', type: 'choice', choice: 'REPLY', confidence: 0.9,
    probabilities: [{ value: 'WAIT', probability: 0.05 }, { value: 'JOIN', probability: 0.05 }, { value: 'REPLY', probability: 0.9 }] }] });
  const working = await connections.saveDecisionProvider({ model: 'company/decision-v2', endpoint: 'https://decision.example/v2/decisions' });
  assert.deepEqual([working.available, working.error, working.model], [true, undefined, 'company/decision-v2']);
  assert.equal(asked.at(-1).url, 'https://decision.example/v2/decisions');
  const form = (await connections.kernelState()).decisionForm;
  assert.deepEqual(form, { enabled: true, hasKey: true, model: 'company/decision-v2', endpoint: 'https://decision.example/v2/decisions' });
  assert.equal(JSON.stringify([working, form]).includes('synthetic-private'), false);

  // The service answers as another model than the one asked for: that is not a working setup.
  const mismatch = await connections.saveDecisionProvider({ model: 'company/decision-v3' });
  assert.deepEqual([mismatch.available, mismatch.error], [false, 'ATTENTION_INVALID_RESPONSE']);

  // An emptied field returns to the default, and a switched-off model is not asked.
  const before = asked.length;
  const off = await connections.saveDecisionProvider({ model: '', endpoint: '', enabled: false });
  assert.deepEqual([off.enabled, off.available, off.model], [false, false, DECISION_DEFAULTS.model]);
  assert.equal(asked.length, before);
  assert.deepEqual(Object.keys(JSON.parse(await readFile(decisionSettings.filename, 'utf8'))).sort(), ['apiKey', 'enabled', 'version']);
});
