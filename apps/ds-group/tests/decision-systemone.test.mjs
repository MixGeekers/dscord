import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createDecisionProvider, createSystemOneDecisionProvider, attentionQuestion, turnQuestion } from '../src/decision-provider.mjs';
import { decisionState } from '../src/decision-state.mjs';
import { decisionPresetConfiguration, decisionEnvironment } from '../src/decision-presets.mjs';

const answer = (model, question = attentionQuestion, choice = question.choices.at(-1).value) => ({
  model, answers: { [question.name]: { type: 'choice', choice, confidence: 0.9,
    probabilities: Object.fromEntries(question.choices.map(item => [item.value, item.value === choice ? 0.9 : 0.05])) } },
  usage: { input_tokens: 42, output_tokens: 7 },
});

test('Jev and Clef reuse both choice questions without OpenAI fields or protocol-specific prompts', async () => {
  for (const preset of ['typesafe-jev', 'cloudflare-clef']) {
    const config = decisionPresetConfiguration({ preset, accountId: '0123456789abcdef0123456789abcdef' });
    const seen = [];
    const provider = createDecisionProvider({ ...config, apiKey: 'synthetic-secret', fetchImpl: async (url, options) => {
      const body = JSON.parse(options.body); seen.push({ url, body, options });
      const [name] = Object.keys(body.questions);
      const question = name === attentionQuestion.name ? attentionQuestion : turnQuestion;
      const result = answer(config.model, question);
      return Response.json(preset === 'cloudflare-clef' ? { success: true, result, errors: [], messages: [] } : result);
    } });
    const input = { self: { id: '@shiyu:test' }, currentMessages: [{ body: '我们出去走走？' }] };
    assert.equal((await provider.decide(input)).action, 'SPEAK');
    assert.equal((await provider.decide({ ...input, phase: 'during' }, { question: turnQuestion })).action, 'REPLY');
    assert.equal(seen.length, 2);
    for (const [index, question] of [attentionQuestion, turnQuestion].entries()) {
      assert.deepEqual(seen[index].body.questions, { [question.name]: { type: 'choice', instructions: question.instructions,
        criteria: Object.fromEntries(question.choices.map(item => [item.value, item.description])) } });
      assert.equal(seen[index].body.input, undefined);
      assert.equal(seen[index].body.prompt_cache_options, undefined);
      assert.equal(seen[index].options.headers.Authorization, 'Bearer synthetic-secret');
      assert.equal(seen[index].options.redirect, 'error');
    }
    assert.deepEqual(seen[0].body.state, decisionState(input));
    assert.equal(provider.health().health, 'ok');
    assert.equal(JSON.stringify(provider.health()).includes('synthetic-secret'), false);
  }
});

test('Jev aliases retain the returned version while pinned versions and Clef variants cannot drift', async () => {
  const provider = createSystemOneDecisionProvider({ model: 'jev-latest', apiKey: 'synthetic',
    fetchImpl: async () => Response.json(answer('jev-1.14.0')) });
  assert.equal((await provider.decide({})).model, 'jev-1.14.0');
  for (const [model, returned, cloudflare] of [['jev-1.14.0', 'jev-1.13.0', false], ['jev-preview', 'another-model', false], ['clef', 'clef-flash', true]]) {
    const provider = createSystemOneDecisionProvider({ model, cloudflare, apiKey: 'synthetic', fetchImpl: async () => {
      const result = answer(returned); return Response.json(cloudflare ? { success: true, result } : result);
    } });
    await assert.rejects(provider.decide({}), { code: 'ATTENTION_INVALID_RESPONSE' });
  }
});

test('malformed System One distributions and unsuccessful Workers AI envelopes stay errors', async t => {
  const base = answer('clef');
  const choice = base.answers.participation;
  const cases = [
    [{ success: false, errors: [{ message: 'synthetic-secret' }] }, 'ATTENTION_SERVICE_ERROR'],
    [{ success: true, result: { ...base, answers: {} } }, 'ATTENTION_INVALID_RESPONSE'],
    [{ success: true, result: { ...base, answers: [] } }, 'ATTENTION_INVALID_RESPONSE'],
    ...[
      { ...choice, choice: 'JOIN' }, { ...choice, probabilities: { SPEAK: 1 } },
      { ...choice, probabilities: { LISTEN: 0.1, WAIT: 0.1, SPEAK: 0.1 } },
      { ...choice, probabilities: { LISTEN: 0, WAIT: 0, SPEAK: 1, unexpected: 0 } },
      { ...choice, confidence: 2 }, { ...choice, probabilities: ['LISTEN', 'WAIT', 'SPEAK'] },
    ].map(value => [{ success: true, result: { ...base, answers: { participation: value } } }, 'ATTENTION_INVALID_RESPONSE']),
  ];
  for (const [index, [value, code]] of cases.entries()) await t.test(String(index), async () => {
    let requests = 0;
    const provider = createSystemOneDecisionProvider({ model: 'clef', cloudflare: true, apiKey: 'synthetic-secret',
      fetchImpl: async () => { requests++; return Response.json(value); } });
    await assert.rejects(provider.decide({}), error => error.code === code && !error.message.includes('synthetic-secret'));
    assert.equal(requests, 1);
    assert.equal(provider.health().health, 'error');
  });
});

test('System One requests honor timeout and cancellation without an implicit retry', async () => {
  for (const abort of [false, true]) {
    let requests = 0;
    const controller = new AbortController();
    const provider = createSystemOneDecisionProvider({ apiKey: 'synthetic', timeoutMs: 20,
      fetchImpl: async (url, { signal }) => {
        requests++;
        if (abort) controller.abort();
        if (signal.aborted) throw signal.reason;
        return new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 500); // Keep the test alive while AbortSignal.timeout fires.
          signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
        });
      } });
    await assert.rejects(provider.decide({}, { signal: controller.signal }), { code: abort ? 'ATTENTION_ABORTED' : 'ATTENTION_TIMEOUT' });
    assert.equal(requests, 1);
  }
});

test('real local HTTP verifies both System One payloads and the Cloudflare result envelope', async t => {
  const seen = [];
  const server = createServer(async (request, response) => {
    let text = ''; for await (const chunk of request) text += chunk;
    const body = JSON.parse(text); seen.push({ path: request.url, body });
    const question = Object.keys(body.questions)[0] === 'participation' ? attentionQuestion : turnQuestion;
    const result = answer(body.model, question);
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(request.url === '/workers-ai' ? { success: true, result } : result));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const cloudflare of [false, true]) {
    const provider = createSystemOneDecisionProvider({ cloudflare, model: cloudflare ? 'clef-flash' : 'jev-1.14.0',
      apiKey: 'synthetic', endpoint: origin + (cloudflare ? '/workers-ai' : '/v1/systemone') });
    assert.equal((await provider.decide({ text: '你好' })).action, 'SPEAK');
    assert.equal((await provider.decide({ phase: 'before' }, { question: turnQuestion })).action, 'REPLY');
  }
  assert.equal(seen.length, 4);
  assert.equal(seen[2].body.model, 'clef-flash');
});

test('presets validate Cloudflare routing and isolate generic environment keys by selected service', () => {
  const cf = decisionPresetConfiguration({ preset: 'cloudflare-clef', accountId: '0123456789abcdef0123456789abcdef', model: 'clef-flash' });
  assert.match(cf.endpoint, /\/ai\/run\/@cf\/cloudflare\/clef-flash$/);
  assert.throws(() => decisionPresetConfiguration({ preset: 'cloudflare-clef', model: 'jev-latest' }), { code: 'INVALID_DECISION_MODEL' });
  assert.throws(() => decisionPresetConfiguration({ preset: 'cloudflare-clef', accountId: '../account' }), { code: 'INVALID_DECISION_ACCOUNT' });
  const env = { DSCORD_DECISION_PRESET: 'typesafe-jev', DSCORD_DECISION_API_KEY: 'synthetic-jev', OPENAI_API_KEY: 'synthetic-openai',
    CLOUDFLARE_API_TOKEN: 'synthetic-cloudflare' };
  assert.equal(decisionEnvironment(env).apiKey, 'synthetic-jev');
  assert.equal(decisionEnvironment(env, 'openai-decisions').apiKey, 'synthetic-openai');
  assert.equal(decisionEnvironment(env, 'cloudflare-clef').apiKey, 'synthetic-cloudflare');
});
