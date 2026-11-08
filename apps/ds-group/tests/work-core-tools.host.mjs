import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assertObjectJsonSchema, projectToolSchema } from '@deepseek-ai/dsh-tools';
import { WorkCore } from '../dsh-connect/work-core.mjs';

// The provider receives exactly what the pinned DSH projects from the registered
// definitions, so every front and worker tool must project to an object schema.
test('front and worker tools register as object JSON Schemas under the pinned DSH SDK', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'work-core-host-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const registered = new Map();
  const agent = id => ({ session: { id }, cancel() {}, ctx: { tools: {
    register: def => { registered.set(def.name, def); return () => {}; }, restrict: () => () => {}, schemas: () => [] } } });
  const core = new WorkCore({
    ctx: { tools: { guard: () => () => {} }, sessionController: {
      create: async () => ({ sessionId: 'worker-1' }), prompt: async () => ({ accepted: true }), selectModel: async () => ({}) } },
    native: { bot: async () => ({ id: 'native', name: 'Lin', sessionId: 'front' }), agent: async id => agent(id) },
    node: { nativeBotId: 'native', directory }, state: { tasks: {} }, save: async () => {},
  });
  t.after(() => core.dispose());
  await core.serveFront(agent('front'));
  await core.dispatch({ title: 'x', brief: 'y' });
  const names = ['dispatch_work', 'task_status', 'task_cancel', 'task_note', 'work_report', 'work_ask'];
  assert.deepEqual([...registered.keys()].sort(), [...names].sort());
  for (const name of names) {
    const schema = projectToolSchema(registered.get(name), true).parameters;
    assert.doesNotThrow(() => assertObjectJsonSchema(schema), name);
    assert.equal(schema.type, 'object', name);
  }
  assert.deepEqual(projectToolSchema(registered.get('dispatch_work'), true).parameters.required.sort(), ['audience', 'brief', 'title']);
});
