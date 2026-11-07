import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MatrixClient } from './matrix-client.mjs';
import { withRoomDisplayNames } from './participant-labels.mjs';
import { requireNodeScope } from './node-auth.mjs';
import { DEFAULT_MAX_UPLOAD_BYTES } from './media.mjs';
import { policyError } from './governance.mjs';
import {
  denyWork,
  trustedRoomParticipants,
  validateOwnerGrants,
  workRequestId,
} from './bot-work-policy.mjs';

const memberPath = (roomId) =>
  `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}`;
/** Home-side owner grants and durable authorization receipts. No remote Core credentials are used. */
export class BotWorkService {
  constructor({
    setup,
    accounts,
    governance,
    dataRoot,
    authorizeNode,
    readJsonBody,
    matrixFor,
    tasks,
    nativeBot = () => false,
    maxBytes = () => DEFAULT_MAX_UPLOAD_BYTES,
  }) {
    Object.assign(this, {
      setup,
      accounts,
      governance,
      authorizeNode,
      readJsonBody,
      tasks,
      nativeBot,
      maxBytes,
    });
    this.matrixFor =
      matrixFor ||
      ((bot) =>
        new MatrixClient({
          baseUrl: setup.homeserverUrl,
          accessToken: bot.accessToken,
        }));
    this.db = new DatabaseSync(path.join(dataRoot, 'bot-work.sqlite'));
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS owner_work_grants (bot_id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,revision INTEGER NOT NULL,grants_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS bot_work_audit (sequence INTEGER PRIMARY KEY AUTOINCREMENT,request_id TEXT NOT NULL,bot_id TEXT NOT NULL,
        stage TEXT NOT NULL,tool TEXT,call_id TEXT,decision TEXT NOT NULL,detail TEXT NOT NULL,at TEXT NOT NULL);`);
  }

  bot(botId) {
    const bot = this.accounts.person(botId);
    if (
      !bot ||
      bot.kind !== 'bot' ||
      !bot.accessToken ||
      !this.accounts.publicParticipants().some((person) => person.id === botId)
    )
      throw denyWork('Unknown active local Bot');
    this.accounts.assertActive?.(bot.id);
    if (bot.ownerId) this.accounts.assertActive?.(bot.ownerId);
    return bot;
  }

  grants(bot) {
    const row = this.db
      .prepare('SELECT * FROM owner_work_grants WHERE bot_id=?')
      .get(bot.id);
    if (row && row.owner_id !== bot.ownerId)
      throw denyWork('The work grant belongs to a different Bot owner');
    return row
      ? { revision: row.revision, grants: JSON.parse(row.grants_json) }
      : { revision: 0, grants: [] };
  }

  saveGrants(bot, input) {
    const next = validateOwnerGrants(input);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.grants(bot);
      if (previous.revision !== next.revision)
        throw policyError(
          409,
          'Owner work grants changed; reload before saving',
        );
      next.revision++;
      this.db
        .prepare(
          'INSERT INTO owner_work_grants VALUES (?,?,?,?) ON CONFLICT(bot_id) DO UPDATE SET revision=excluded.revision,grants_json=excluded.grants_json',
        )
        .run(bot.id, bot.ownerId, next.revision, JSON.stringify(next.grants));
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return next;
  }

  audit(input, decision, detail = '') {
    this.db
      .prepare(
        'INSERT INTO bot_work_audit(request_id,bot_id,stage,tool,call_id,decision,detail,at) VALUES (?,?,?,?,?,?,?,?)',
      )
      .run(
        input.requestId,
        input.botId,
        input.stage || 'accept',
        input.tool || null,
        input.callId || null,
        decision,
        String(detail).slice(0, 2000),
        new Date().toISOString(),
      );
  }

  async room(bot, roomId) {
    if (
      typeof roomId !== 'string' ||
      !roomId.startsWith('!') ||
      roomId.length > 512
    )
      throw policyError(400, 'An exact Matrix room ID is required');
    const client = this.matrixFor(bot);
    const [members, policy] = await Promise.all([
      client.request('GET', `${memberPath(roomId)}/joined_members`),
      this.governance.read(),
    ]);
    const joinedIds = Object.keys(members.joined || {}).sort();
    if (!joinedIds.includes(bot.id))
      throw denyWork('The original Bot is not joined to this room');
    let participants = trustedRoomParticipants({
      policy,
      locals: this.accounts.publicParticipants(),
      joinedIds,
    });
    if (this.nativeBot(bot.id)) {
      const known = new Map([...this.accounts.publicParticipants(), ...participants].map(person => [person.id, person]));
      participants = joinedIds.map(id => known.get(id) || { id, kind: 'unknown', identitySource: 'matrix-membership',
        name: members.joined[id].display_name || id, localpart: id.slice(1, id.indexOf(':')) });
    }
    return { client, policy, joinedIds, participants: withRoomDisplayNames(participants, members.joined) };
  }

  async join(botId, roomId, scope) {
    requireNodeScope(scope, { botId });
    const bot = this.bot(botId);
    if (this.nativeBot(botId)) {
      if (typeof roomId !== 'string' || !roomId.startsWith('!')) throw policyError(400, 'A Matrix room ID is required');
      const result = await this.matrixFor(bot).join(roomId);
      if (result.room_id !== roomId) throw denyWork('Matrix joined a different room');
      return { roomId, status: 'joined', botId, ownerId: bot.ownerId, mode: 'native' };
    }
    const policy = await this.governance.read();
    const rule = policy.rooms.find((row) => row.roomId === roomId);
    const owner = this.grants(bot).grants.find((row) => row.roomId === roomId);
    const ceiling = policy.botPolicies.find((row) => row.botId === botId);
    if (
      !rule?.enabled ||
      !rule.botIds.includes(botId) ||
      !rule.memberIds.includes(botId) ||
      !owner?.enabled ||
      !ceiling?.enabled ||
      !ceiling.roomIds.includes(roomId) ||
      (rule.authority !== policy.serverName &&
        !policy.partners.some(
          (row) => row.enabled && row.serverName === rule.authority,
        ))
    ) {
      throw denyWork(
        'Joining this external room requires the existing owner and home server grants',
      );
    }
    const client = this.matrixFor(bot);
    const joined = await client.request(
      'GET',
      '/_matrix/client/v3/joined_rooms',
    );
    if (joined.joined_rooms?.includes(roomId))
      return { roomId, status: 'joined', botId, ownerId: bot.ownerId };
    const sync = await client.request(
      'GET',
      `/_matrix/client/v3/sync?timeout=0&filter=${encodeURIComponent(JSON.stringify({ room: { timeline: { limit: 0 } } }))}`,
    );
    const invite = sync.rooms?.invite?.[roomId]?.invite_state?.events?.find(
      (event) =>
        event.type === 'm.room.member' &&
        event.state_key === botId &&
        event.content?.membership === 'invite',
    );
    const inviter = trustedRoomParticipants({
      policy,
      locals: this.accounts.publicParticipants(),
      joinedIds: invite ? [invite.sender] : [],
    })[0];
    if (!invite || !inviter || !rule.memberIds.includes(inviter.id))
      throw denyWork(
        'A real invitation from an exactly admitted room member is required',
      );
    const action = {
      requestId: `join-${workRequestId(botId, roomId).slice(7)}`,
      botId,
      stage: 'join',
    };
    this.audit(
      action,
      'authorized',
      JSON.stringify({ roomId, inviterId: inviter.id }),
    );
    const result = await client.join(roomId);
    if (result.room_id !== roomId)
      throw denyWork('Matrix joined a different room');
    this.audit(action, 'observed:completed', roomId);
    return { roomId, status: 'joined', botId, ownerId: bot.ownerId };
  }

  handles(pathname) {
    return (
      /^\/api\/bots\/[^/]+\/work-grants$/.test(pathname) ||
      /^\/internal\/bots\/[^/]+\/(join|rooms\/[^/]+\/directory)$/.test(
        pathname,
      )
    );
  }

  async handle({ request, url, send }) {
    const grant = url.pathname.match(/^\/api\/bots\/([^/]+)\/work-grants$/);
    if (grant) {
      const token = request.headers.authorization?.replace(/^Bearer /, '');
      const { user } = await this.accounts.me(token);
      const bot = this.bot(decodeURIComponent(grant[1]));
      if (bot.ownerId !== user.id)
        throw denyWork(
          'Only the existing Bot owner can change node work grants',
        );
      if (request.method === 'GET') return send(200, this.grants(bot));
      if (request.method === 'PUT')
        return send(
          200,
          this.saveGrants(bot, await this.readJsonBody(request)),
        );
      throw policyError(405, 'Unsupported owner grant operation');
    }
    const scope = this.authorizeNode(request);
    const join = url.pathname.match(/^\/internal\/bots\/([^/]+)\/join$/);
    if (request.method === 'POST' && join) {
      const input = await this.readJsonBody(request);
      return send(
        200,
        await this.join(decodeURIComponent(join[1]), input.roomId, scope),
      );
    }
    const directory = url.pathname.match(
      /^\/internal\/bots\/([^/]+)\/rooms\/([^/]+)\/directory$/,
    );
    if (request.method === 'GET' && directory) {
      const botId = decodeURIComponent(directory[1]);
      requireNodeScope(scope, { botId });
      const { participants } = await this.room(
        this.bot(botId),
        decodeURIComponent(directory[2]),
      );
      return send(200, { participants });
    }
    throw policyError(405, 'Unsupported Bot work operation');
  }

  close() {
    this.db.close();
  }
}
