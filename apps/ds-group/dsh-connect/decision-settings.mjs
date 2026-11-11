import path from 'node:path';
import { readOptionalJson, savePrivateJson } from '../scripts/server-init.mjs';
import { createDecisionProvider, DecisionError, turnQuestion, attentionQuestion } from '../src/decision-provider.mjs';
import { DECISION_PRESETS, decisionPreset, decisionPresetConfiguration, decisionEnvironment } from '../src/decision-presets.mjs';

// Synthetic exchanges only. Connectivity and protocol checks are not semantic quality evidence.
const PROBE = Object.freeze({ version: 1, self: { id: 'dscord-check', name: 'DSCord' }, phase: 'before', pending: [{ senderName: 'DSCord', text: '你好' }] });
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const profileValid = value => object(value) && ['apiKey', 'model', 'endpoint', 'accountId'].every(field => value[field] === undefined || typeof value[field] === 'string');

/** Private, per-service credentials. Only status and a submit-only form reach the local owner. */
export class DecisionSettings {
  constructor({ directory, environment = process.env, providerFactory = createDecisionProvider }) {
    this.filename = path.join(directory, 'decision-provider.json');
    this.environment = environment;
    this.providerFactory = providerFactory;
    this.config = { version: 2, enabled: true, preset: environment.DSCORD_DECISION_PRESET || 'openai-decisions', profiles: {} };
    this.provider = null;
  }

  async initialize() {
    const saved = await readOptionalJson(this.filename);
    if (saved) {
      if (typeof saved.enabled !== 'boolean') throw new Error('DECISION_SETTINGS_INVALID');
      if (saved.version === 1 && profileValid(saved)) {
        const { apiKey, model, endpoint } = saved;
        // A v1 file always meant the OpenAI Decisions protocol, including custom proxy routes.
        this.config = { version: 2, enabled: saved.enabled, preset: 'openai-decisions', profiles: {
          'openai-decisions': Object.fromEntries(Object.entries({ apiKey, model, endpoint }).filter(([, value]) => value !== undefined)),
        } };
      } else if (saved.version === 2 && object(saved.profiles) && DECISION_PRESETS.some(item => item.id === saved.preset)
        && Object.entries(saved.profiles).every(([id, profile]) => DECISION_PRESETS.some(item => item.id === id) && profileValid(profile))) {
        this.config = saved;
      } else throw new Error('DECISION_SETTINGS_INVALID');
    }
    this.refresh();
    return this;
  }

  options(config = this.config, id = config.preset) {
    const environment = decisionEnvironment(this.environment, id);
    const profile = config.profiles[id] || {};
    return { ...decisionPresetConfiguration({ ...environment, ...profile, preset: id }), apiKey: profile.apiKey || environment.apiKey };
  }

  refresh() {
    const options = this.options();
    this.provider = this.config.enabled && options.apiKey && options.endpoint ? this.providerFactory(options) : null;
  }

  publicStatus() {
    const options = this.options();
    const health = this.provider?.health?.();
    return { configured: Boolean(options.apiKey && options.endpoint), enabled: this.config.enabled,
      available: !this.config.enabled || !this.provider ? false
        : health?.health === 'ok' ? true : health?.health === 'error' ? false : null,
      preset: this.config.preset, model: this.provider?.model || options.model, health: health?.status || health?.health || 'unknown',
      ...(health?.lastErrorCode ? { error: health.lastErrorCode } : {}) };
  }

  form() {
    const presets = DECISION_PRESETS.map(preset => {
      const { model, endpoint, apiKey, accountId } = this.options(this.config, preset.id);
      return { id: preset.id, name: preset.name, model, endpoint, hasKey: Boolean(apiKey), models: [...preset.models],
        ...(preset.accountRequired ? { accountRequired: true, accountId } : {}) };
    });
    const active = presets.find(preset => preset.id === this.config.preset);
    return { enabled: this.config.enabled, preset: active.id, hasKey: active.hasKey, model: active.model, endpoint: active.endpoint,
      ...(active.accountRequired ? { accountId: active.accountId } : {}), presets };
  }

  /** Both participation and turn-taking must speak the selected protocol. No private chat is sent. */
  async verify() {
    if (this.provider?.decide) {
      try {
        await this.provider.decide({ ...PROBE, currentMessages: [{ body: '大家好' }] }, { question: attentionQuestion });
        await this.provider.decide(PROBE, { question: turnQuestion });
      } catch { /* The provider's safe health code reports the failed request; no automatic retry. */ }
    }
    return this.publicStatus();
  }

  async save({ apiKey, enabled, model, endpoint, preset = this.config.preset, accountId } = {}) {
    decisionPreset(preset);
    if (enabled !== undefined && typeof enabled !== 'boolean') throw new Error('INVALID_DECISION_SETTING');
    if (apiKey !== undefined && (typeof apiKey !== 'string' || apiKey.length > 4096)) throw new Error('INVALID_DECISION_KEY');
    const profile = { ...this.config.profiles[preset],
      ...(apiKey?.trim() ? { apiKey: apiKey.trim() } : {}),
      ...(model === undefined ? {} : { model }), ...(endpoint === undefined ? {} : { endpoint }),
      ...(accountId === undefined ? {} : { accountId }),
    };
    for (const field of ['model', 'endpoint', 'accountId']) if (profile[field] === '') delete profile[field];
    if (!profileValid(profile)) throw new Error('INVALID_DECISION_SETTING');
    if (preset === 'cloudflare-clef') {
      const environment = decisionEnvironment(this.environment, preset);
      // Keep the normal Workers AI route derived from account/model rather than freezing it as a proxy override.
      if (!environment.endpoint && profile.endpoint === decisionPresetConfiguration({ ...environment, ...profile, endpoint: '', preset }).endpoint) {
        delete profile.endpoint;
      }
    }
    const next = { version: 2, enabled: enabled ?? this.config.enabled, preset, profiles: { ...this.config.profiles, [preset]: profile } };
    const options = this.options(next);
    if (next.enabled && preset === 'cloudflare-clef' && !options.endpoint) {
      throw new DecisionError('INVALID_DECISION_ACCOUNT', 'Enter a Cloudflare Account ID or a complete Workers AI endpoint');
    }
    await savePrivateJson(this.filename, next);
    this.config = next;
    this.refresh();
    return this.publicStatus();
  }
}
