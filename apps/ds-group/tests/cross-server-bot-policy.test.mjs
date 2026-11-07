import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BotWorkService } from '../src/bot-work.mjs';
import { emptyPolicy } from '../src/governance.mjs';

const botId = '@helper:a.test';
const ownerId = '@owner:a.test';
const humanId = '@alice:b.test';
const roomId = '!work:b.test';
const issuerId = '@dscord-control:b.test';
const tools = ['read', 'write', 'edit', 'read_image'];

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dscord-bot-policy-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bot = {
    id: botId,
    kind: 'bot',
    name: 'Helper',
    ownerId,
    localpart: 'helper',
    accessToken: 'synthetic-bot-token',
  };
  const locals = [{ id: ownerId, kind: 'human', name: 'Owner' }, bot];
  const event = {
    event_id: '$request',
    room_id: roomId,
    type: 'm.room.message',
    sender: humanId,
    content: {
      body: 'Read my file and write a report',
      'org.ds_group': { to: [botId] },
    },
  };
  let policy = emptyPolicy('a.test');
  policy.partners = [{ serverName: 'b.test', name: 'B', enabled: true }];
  policy.members = [
    { id: humanId, kind: 'human', name: 'Alice', enabled: true },
  ];
  policy.rooms = [
    {
      roomId,
      authority: 'b.test',
      name: 'Work',
      enabled: true,
      memberIds: [botId, humanId],
      botIds: [botId],
      tools,
    },
  ];
  policy.botPolicies = [
    {
      botId,
      enabled: true,
      requesterIds: [humanId],
      roomIds: [roomId],
      tools,
      canDelegate: true,
    },
  ];
  const state = {
    type: 'org.dscord.work_policy',
    state_key: '',
    event_id: '$policy-1',
    sender: issuerId,
    content: {
      schemaVersion: 1,
      roomId,
      authority: 'b.test',
      issuerId,
      revision: 1,
      enabled: true,
      localMemberAdmission: 'matrix-membership',
      memberIds: [botId],
      botIds: [botId],
      tools,
    },
  };
  const power = {
    type: 'm.room.power_levels',
    state_key: '',
    content: { users: { [issuerId]: 100 } },
  };
  let joinedIds = [botId, humanId, issuerId];
  const events = new Map([[event.event_id, event]]);
  const matrix = {
    request: async (_method, route) => {
      if (route.endsWith('/joined_members'))
        return { joined: Object.fromEntries(joinedIds.map((id) => [id, {}])) };
      if (route.endsWith('/state')) return [state, power];
      if (route.includes('/event/')) {
        const found = events.get(decodeURIComponent(route.split('/event/')[1]));
        if (!found) throw Object.assign(new Error('No event'), { status: 404 });
        return structuredClone(found);
      }
      throw new Error(`Unexpected Matrix route ${route}`);
    },
  };
  const service = new BotWorkService({
    setup: { serverName: 'a.test' },
    accounts: {
      person: (id) => locals.find((person) => person.id === id),
      publicParticipants: () => locals,
    },
    governance: { read: async () => policy },
    dataRoot: directory,
    matrixFor: () => matrix,
  });
  t.after(() => service.close());
  const grant = {
    revision: 0,
    grants: [{ roomId, enabled: true, requesterIds: [humanId], tools }],
  };
  return {
    directory,
    service,
    bot,
    locals,
    event,
    events,
    policy,
    state,
    power,
    matrix,
    grant,
    setJoined: (ids) => {
      joinedIds = ids;
    },
    setPolicy: (value) => {
      policy = value;
    },
  };
}

test('room directories expose only admitted joined identities and never the rest of the admission list', async (t) => {
  const f = await fixture(t);
  f.policy.members.push({
    id: '@other:b.test',
    name: 'Other',
    kind: 'human',
    enabled: true,
  });
  const { participants } = await f.service.room(f.bot, roomId);
  assert.deepEqual(
    participants.map((person) => person.id).sort(),
    [botId, humanId].sort(),
  );
});

test('a real invitation still requires exact owner, server, inviter and original node scope to join', async (t) => {
  const f = await fixture(t);
  let inviter = humanId;
  let present = true;
  let joins = 0;
  const previous = f.matrix.request;
  f.matrix.request = async (method, route) => {
    if (route.endsWith('/joined_rooms')) return { joined_rooms: [] };
    if (route.includes('/sync?'))
      return {
        rooms: {
          invite: present
            ? {
                [roomId]: {
                  invite_state: {
                    events: [
                      {
                        type: 'm.room.member',
                        state_key: botId,
                        sender: inviter,
                        content: { membership: 'invite' },
                      },
                    ],
                  },
                },
              }
            : {},
        },
      };
    return previous(method, route);
  };
  f.matrix.join = async (id) => {
    joins++;
    return { room_id: id };
  };
  await assert.rejects(f.service.join(botId, roomId, { botId }), {
    code: 'BOT_WORK_DENIED',
  });
  f.service.saveGrants(f.bot, f.grant);
  await assert.rejects(
    f.service.join(botId, roomId, { botId: '@other:a.test' }),
    { status: 403 },
  );
  inviter = '@alice:c.test';
  await assert.rejects(f.service.join(botId, roomId, { botId }), {
    code: 'BOT_WORK_DENIED',
  });
  inviter = humanId;
  present = false;
  await assert.rejects(f.service.join(botId, roomId, { botId }), {
    code: 'BOT_WORK_DENIED',
  });
  present = true;
  const joined = await f.service.join(botId, roomId, { botId });
  assert.equal(joined.botId, botId);
  assert.equal(joined.ownerId, ownerId);
  assert.equal(joins, 1);
  f.service.saveGrants(f.bot, { revision: 1, grants: [] });
  await assert.rejects(f.service.join(botId, roomId, { botId }), {
    code: 'BOT_WORK_DENIED',
  });
  assert.equal(joins, 1);
});
