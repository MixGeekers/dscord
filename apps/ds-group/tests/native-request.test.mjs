import test from 'node:test';
import assert from 'node:assert/strict';
import { projectNativeRequestMessage, withoutNativeMemoryViews } from '../src/native-request.mjs';
import { legacyNativeRequest, requestEnvelope } from './fixtures/legacy-native-request.mjs';

// What a front turn reads today is covered by front-prompt.test.mjs; these are the envelopes older Sessions still hold.
test('a verified historical envelope projects only its derived views, preserving message ID, source, files and human body', () => {
  const original = legacyNativeRequest({ body: 'A quoted DSCORD_REQUEST=x and "memoryView": {"keep":true} are my own words.' });
  original.content.push({ type: 'text', text: 'Separate content block.' });
  const bytes = JSON.stringify(original), result = projectNativeRequestMessage(original);
  assert.notEqual(result, original); assert.equal(result.id, original.id); assert.equal(result.source, original.source);
  assert.deepEqual(result.content.slice(1), original.content.slice(1));
  assert.deepEqual(requestEnvelope(result), withoutNativeMemoryViews(requestEnvelope(original)));
  assert.equal(JSON.stringify(original), bytes);
  assert.equal(projectNativeRequestMessage(result), result);
});

test('markers, quoted envelopes and mismatched source identities never authorize a projection', () => {
  const original = legacyNativeRequest();
  for (const mutate of [
    m => { m.source = { kind: 'user' }; },
    m => { m.source.eventId = '$different'; },
    m => { m.source.roomId = '!different:test'; },
    m => { m.source.sender.id = '@different:test'; },
    m => { m.source.rpcId = 'different-request'; },
    m => { m.source.kind = 'tool-context'; },
    m => { m.content[0].text = 'Human quotation:\n' + m.content[0].text; },
    m => { const envelope = requestEnvelope(m); envelope.replyRoute.roomId = '!different:test'; m.content[0].text = m.content[0].text.split('\n').slice(0,-1).join('\n') + '\n' + JSON.stringify(envelope); },
  ]) { const message = structuredClone(original); mutate(message); assert.equal(projectNativeRequestMessage(message), message); }
});
