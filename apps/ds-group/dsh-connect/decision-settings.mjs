import path from 'node:path';
import { readOptionalJson, savePrivateJson } from '../scripts/server-init.mjs';
import { createOpenAIDecisionProvider, decisionProviderConfiguration, turnQuestion } from '../src/decision-provider.mjs';

// One short, synthetic exchange: enough for the service to answer, with nothing of the owner's in it.
const PROBE = Object.freeze({ version: 1, self: { id: 'dscord-check', name: 'DSCord' }, phase: 'before', pending: [{ senderName: 'DSCord', text: '你好' }] });

/** A private node setting. Only publicStatus is returned to a browser or Core. */
export class DecisionSettings {
  constructor({ directory, environment = process.env, providerFactory = createOpenAIDecisionProvider }) {
    this.filename = path.join(directory, 'decision-provider.json');
    this.environment = environment;
    this.providerFactory = providerFactory;
    this.config = { version: 1, enabled: true };
    this.provider = null;
  }

  async initialize() {
    const saved = await readOptionalJson(this.filename);
    if (saved) {
      if (saved.version !== 1 || typeof saved.enabled !== 'boolean'
        || saved.apiKey !== undefined && typeof saved.apiKey !== 'string') {
        throw new Error('DECISION_SETTINGS_INVALID');
      }
      this.config = saved;
    }
    this.refresh();
    return this;
  }

  key(config = this.config) {
    return config.apiKey || this.environment.DSCORD_DECISION_API_KEY || this.environment.OPENAI_API_KEY || '';
  }

  options(config = this.config) {
    return { ...decisionProviderConfiguration({ model: config.model ?? (this.environment.DSCORD_DECISION_MODEL || undefined),
      endpoint: config.endpoint ?? (this.environment.DSCORD_DECISION_ENDPOINT || undefined) }), apiKey: this.key(config) };
  }

  refresh() {
    const options = this.options();
    this.provider = this.config.enabled && this.key()
      ? this.providerFactory(options) : null;
  }

  publicStatus() {
    const health = this.provider?.health?.();
    return { configured: Boolean(this.key()), enabled: this.config.enabled,
      available: !this.config.enabled || !this.provider ? false
        : health?.health === 'ok' ? true : health?.health === 'error' ? false : null,
      model: this.provider?.model || this.options().model, health: health?.status || health?.health || 'unknown',
      ...(health?.lastErrorCode ? { error: health.lastErrorCode } : {}) };
  }

  /** What the owner's own settings page fills its form with. The address stays on this device; the key is never read back. */
  form() {
    const { model, endpoint } = this.options();
    return { enabled: this.config.enabled, hasKey: Boolean(this.key()), model, endpoint };
  }

  /**
   * Ask the service one small question, so a wrong key, address or model shows now instead of as Bots that
   * stay quiet later. The outcome is in the provider's health, which publicStatus reports.
   */
  async verify() {
    if (this.provider?.decide) await this.provider.decide(PROBE, { question: turnQuestion }).catch(() => {});
    return this.publicStatus();
  }

  async save({ apiKey, enabled, model, endpoint } = {}) {
    if (enabled !== undefined && typeof enabled !== 'boolean') throw new Error('INVALID_DECISION_SETTING');
    if (apiKey !== undefined && (typeof apiKey !== 'string' || apiKey.length > 4096)) throw new Error('INVALID_DECISION_KEY');
    const next = { ...this.config,
      ...(enabled === undefined ? {} : { enabled }),
      ...(apiKey?.trim() ? { apiKey: apiKey.trim() } : {}),
      ...(model === undefined ? {} : { model }),
      ...(endpoint === undefined ? {} : { endpoint }),
    };
    // An emptied field goes back to the environment's value or the adapter's default.
    for (const field of ['model', 'endpoint']) if (next[field] === '') delete next[field];
    this.options(next);
    await savePrivateJson(this.filename, next);
    this.config = next;
    this.refresh();
    return this.publicStatus();
  }
}
