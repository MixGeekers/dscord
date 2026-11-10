import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { BotNode, createTaskClient, createRosterClient, acquireNodeLock } from '../src/bot-node.mjs';
import { createDeliveryClient } from '../src/node-delivery.mjs';
import { createNodeWorkClient } from '../src/node-work.mjs';
import { NodeStore } from '../src/node-store.mjs';
import { NodeFiles } from '../src/node-files.mjs';
import { MatrixClient } from '../src/matrix-client.mjs';
import { ContactBook } from '../src/contact-book.mjs';
import { readOptionalJson } from '../scripts/server-init.mjs';
import { savePrivateJson } from '../scripts/server-init.mjs';
import { NativeBridge } from './native-bridge.mjs';
import { localBot } from './work-core.mjs';
import { DecisionSettings } from './decision-settings.mjs';
import { KernelNodeClient } from '../src/kernel-node-client.mjs';
import { KERNEL_VERSION, hello } from '../src/node-protocol.mjs';

export class NativeConnections {
  constructor({ ctx, native, decisionSettings, updates, enableKernelControl = true, introduce = hello }) {
    Object.assign(this, { ctx, native, decisionSettings, updates, enableKernelControl, introduce });
    this.connections = new Map();
    // Each native Bot's contact book, open while any of its server connections is.
    this.books = new Map();
  }

  async openBook(nativeBotId, botId) {
    let entry = this.books.get(nativeBotId);
    if (!entry) {
      const directory = path.join(this.directory, 'bots', nativeBotId);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const db = new DatabaseSync(path.join(directory, 'contacts.sqlite'));
      entry = { db, book: new ContactBook({ db }), users: new Set() };
      this.books.set(nativeBotId, entry);
    }
    entry.users.add(botId);
    return entry.book;
  }

  closeBook(nativeBotId, botId) {
    const entry = this.books.get(nativeBotId);
    if (!entry?.users.delete(botId) || entry.users.size) return;
    this.books.delete(nativeBotId);
    entry.db.close();
  }

  async configure({ directory }) {
    this.directory = directory;
    if (this.decisionSettings) return;
    this.decisionSettings = await new DecisionSettings({ directory }).initialize();
    // Asked once at start, so a key that stopped working shows here before a Bot stays quiet because of it.
    void this.decisionSettings.verify();
  }

  decisionStatus() {
    return this.decisionSettings?.publicStatus() || { configured: false, available: false, enabled: true, model: 'gpt-6-luna', health: 'unconfigured' };
  }

  /** Saving asks the service one question, so the answer says whether the settings work. */
  async saveDecisionProvider(settings) {
    if (!this.decisionSettings) throw new Error('DECISION_SETTINGS_UNAVAILABLE');
    await this.decisionSettings.save(settings);
    for (const entry of this.connections.values()) entry.botNode.setDecisionProvider(this.decisionSettings.provider);
    await this.decisionSettings.verify();
    return this.decisionStatus();
  }

  async available() {
    try {
      const { runtime } = await this.native.info();
      return { available: true, mode: 'native', runtime };
    }
    catch (error) { return { available: false, mode: 'native', message: error.message }; }
  }

  observe(entry, input) {
    const { botNode, bridge } = entry;
    const rooms = Object.fromEntries([...new Set(input.events.map(event => event.room_id))]
      .map(roomId => [roomId, input.rooms?.[roomId] || botNode.store.roomContext(roomId)]));
    return bridge.observe({ ...input, participants: botNode.participants, rooms });
  }

  async start(node) {
    if (!node.nativeBotId) throw new Error('请先为此服务器账号绑定一个已有的原生 Bot');
    if (this.connections.has(node.id)) return;
    if (!this.decisionSettings) await this.configure({ directory: this.directory || node.directory });
    const setup = await readOptionalJson(path.join(node.directory, 'matrix-setup.json'));
    const config = await readOptionalJson(path.join(node.directory, 'core-config.json'));
    const participant = setup.participants.find(bot => bot.id === node.id);
    const directory = path.join(node.directory, 'nodes', node.localpart);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const release = await acquireNodeLock(path.join(directory, 'process.lock'));
    let bridge;
    let store;
    const entry = { node, release };
    try {
      // Learn the server's protocol first; a kernel that cannot speak it asks for a compatible release.
      const session = await this.introduce({ coreUrl: node.serverUrl, nodeSecret: config.nodeSecret, botId: node.id,
        nodeId: participant.localpart, capabilities: this.enableKernelControl ? ['kernel-control'] : [] })
        .catch(error => { if (error.protocol) this.updates?.observeProtocol(error.protocol, { compatible: false }); throw error; });
      this.updates?.observeProtocol(session.protocol);
      const kernelControl = this.enableKernelControl && session.capabilities.includes('kernel-control');
      Object.assign(entry, { protocol: session.protocol, capabilities: session.capabilities });
      const work = createNodeWorkClient(node.serverUrl, config.nodeSecret, node.id);
      const matrix = new MatrixClient({ baseUrl: setup.homeserverUrl, accessToken: participant.accessToken });
      // One program core per native Bot, however many chat servers it is connected to.
      bridge = await new NativeBridge({ ctx: this.ctx, native: this.native, node,
        botDirectory: path.join(this.directory, 'bots', node.nativeBotId) }).initialize();
      store = new NodeStore(path.join(directory, 'node.sqlite'), node.id);
      const savedAttention = await readOptionalJson(path.join(node.directory, 'attention.json'));
      const contactBook = await this.openBook(node.nativeBotId, node.id);
      const botNode = new BotNode({ contactBook, participant, participants: setup.participants, roomId: setup.roomId, matrix, store, bridge, work,
        executionMode: 'native', localBots: localBot, attention: savedAttention || node.attention || { mode: 'mention' },
        decisionProvider: this.decisionSettings?.provider,
        observe: input => this.observe(entry, input),
        readAttentionView: input => bridge.readAttentionView(input),
        files: new NodeFiles({ coreUrl: node.serverUrl, accessToken: participant.accessToken, directory: path.join(directory, 'tasks') }),
        tasks: createTaskClient(node.serverUrl, config.nodeSecret),
        delivery: createDeliveryClient(node.serverUrl, participant.accessToken),
        roster: createRosterClient(node.serverUrl, participant.accessToken),
        onError: message => { entry.lastError = message; },
        heartbeat: async body => {
          const kernel = await bridge.kernelState();
          entry.openWork = (kernel.work?.workers?.length ?? 0) + (kernel.work?.queue?.length ?? 0);
          const response = await fetch(new URL('/internal/nodes/heartbeat', node.serverUrl), { method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${config.nodeSecret}` },
            body: JSON.stringify({ ...body, engine: 'DSCord kernel', executionMode: 'native',
              protocol: session.protocol, kernelVersion: KERNEL_VERSION,
              kernel: { runtime: kernel.runtime, work: kernel.work,
                attention: botNode.attentionStatus(), responder: botNode.responderStatus() },
              ...(kernelControl ? { kernelControl: { version: 1 } } : {}) }), signal: AbortSignal.timeout(10000) });
          if (response.status === 426) {
            const answer = await response.json().catch(() => ({}));
            if (answer.protocol) this.updates?.observeProtocol(answer.protocol, { compatible: false });
          }
          if (!response.ok) throw new Error(`Core heartbeat HTTP ${response.status}`);
        },
      });
      Object.assign(entry, { bridge, botNode });
      bridge.core.seat(node.id).contacts = botNode.contacts;
      await botNode.start();
      await bridge.serveFront();
      await bridge.onWorkerResult((task, message, text) => botNode.acceptWorkerResult(task, message, text));
      if (kernelControl) {
        entry.control = new KernelNodeClient({ coreUrl: node.serverUrl, nodeSecret: config.nodeSecret,
          botId: node.id, nodeId: participant.localpart, runtimeId: botNode.runtimeId,
          operations: {
            configureAttention: setting => this.applyAttention(entry, setting),
            memoryProfiles: options => bridge.memoryProfiles(options),
            memoryProfile: options => bridge.memoryProfile(options),
            contacts: options => botNode.contacts.view(options),
            timeline: options => botNode.timeline(options, bridge.core.tasks()),
            memoryChanges: options => bridge.memoryChanges(options),
          }, onError: code => { entry.controlError = code; } });
        entry.control.start();
      }
      this.connections.set(node.id, entry);
    } catch (error) {
      // Each cleanup step runs, and none of them replaces the original failure.
      for (const cleanup of [() => entry.control?.stop(), () => entry.botNode?.stop(), () => bridge?.detach(), () => store?.close(), () => this.closeBook(node.nativeBotId, node.id), release]) {
        await Promise.resolve().then(cleanup).catch(() => {});
      }
      throw error;
    }
  }

  /** No connected Bot is in a turn or has workers running or queued (as of its last heartbeat), so a plugin reload interrupts nothing. */
  idle() {
    return [...this.connections.values()].every(entry => entry.botNode?.state !== 'thinking' && !entry.openWork);
  }

  async stop(node) {
    const entry = this.connections.get(node.id);
    if (!entry) return;
    this.connections.delete(node.id);
    await entry.control?.stop();
    await entry.bridge.detach();
    await entry.botNode.stop();
    this.closeBook(node.nativeBotId, node.id);
    await entry.release();
  }

  async probe(node) {
    const entry = this.connections.get(node.id);
    if (!entry) return { status: 'offline', lastError: null };
    const status = await entry.bridge.runtimeStatus();
    return { status: entry.botNode.lastError ? 'error' : 'online', lastError: entry.botNode.lastError,
      ...status, attention: entry.botNode.attentionStatus() };
  }

  async applyAttention(entry, setting) {
    const state = entry.botNode.configureAttention(setting);
    await savePrivateJson(path.join(entry.node.directory, 'attention.json'), { mode: state.mode, rooms: state.rooms, revision: state.revision });
    return state;
  }

  /** The kernel this DSH runs and the service that decides when Bots join in. */
  async kernelState() {
    return { ...await this.native.info(), decisionProvider: this.decisionStatus(), decisionForm: this.decisionSettings?.form() ?? null };
  }
}
