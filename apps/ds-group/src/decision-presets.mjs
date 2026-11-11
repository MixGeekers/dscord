import { DecisionError, decisionProviderConfiguration } from './decision-provider.mjs';

// Only defaults and protocol names live here. Credentials belong to the node's private settings.
export const DECISION_PRESETS = Object.freeze([
  Object.freeze({ id: 'openai-decisions', name: 'OpenAI Decisions', protocol: 'openai-decisions',
    model: 'gpt-6-luna', endpoint: 'https://api.openai.com/v1/decisions', models: ['gpt-6-luna'] }),
  Object.freeze({ id: 'typesafe-jev', name: 'TypeSafe Jev', protocol: 'systemone',
    model: 'jev-1.14.0', endpoint: 'https://api.typesafe.ai/v1/systemone', models: ['jev-1.14.0', 'jev-1.13.0', 'jev-latest', 'jev-preview'] }),
  Object.freeze({ id: 'cloudflare-clef', name: 'Cloudflare Clef', protocol: 'cloudflare-systemone',
    model: 'clef', endpoint: '', accountRequired: true, models: ['clef', 'clef-flash'] }),
]);

export function decisionPreset(id = 'openai-decisions') {
  const preset = DECISION_PRESETS.find(item => item.id === id);
  if (!preset) throw new DecisionError('INVALID_DECISION_PRESET', 'Choose a supported decision service');
  return preset;
}

export function decisionPresetConfiguration({ preset: id, model, endpoint, accountId = '' } = {}) {
  const preset = decisionPreset(id);
  model ??= preset.model;
  if (preset.accountRequired) {
    if (typeof accountId !== 'string' || accountId !== '' && !/^[a-fA-F0-9]{32}$/.test(accountId)) {
      throw new DecisionError('INVALID_DECISION_ACCOUNT', 'Use the Cloudflare Account ID, a 32-character hexadecimal value');
    }
    if (!preset.models.includes(model)) throw new DecisionError('INVALID_DECISION_MODEL', 'Choose clef or clef-flash');
    endpoint ||= accountId ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/cloudflare/${model}` : '';
    // An incomplete setup can be displayed without constructing a request to a guessed account.
    if (!endpoint) return { preset: preset.id, model, endpoint: '', accountId };
  }
  return { preset: preset.id, ...decisionProviderConfiguration({ model, endpoint: endpoint || preset.endpoint }),
    ...(preset.accountRequired ? { accountId } : {}) };
}

/** Generic decision variables belong only to the service explicitly selected in the environment. */
export function decisionEnvironment(environment = process.env, id = environment.DSCORD_DECISION_PRESET || 'openai-decisions') {
  decisionPreset(id);
  const selected = id === (environment.DSCORD_DECISION_PRESET || 'openai-decisions');
  const apiKey = id === 'openai-decisions' ? environment.OPENAI_API_KEY
    : id === 'typesafe-jev' ? environment.TYPESAFE_API_KEY
      : environment.CLOUDFLARE_API_TOKEN || environment.CLOUDFLARE_AUTH_TOKEN;
  return { preset: id,
    apiKey: selected && environment.DSCORD_DECISION_API_KEY || apiKey || '',
    ...(selected && environment.DSCORD_DECISION_MODEL ? { model: environment.DSCORD_DECISION_MODEL } : {}),
    ...(selected && environment.DSCORD_DECISION_ENDPOINT ? { endpoint: environment.DSCORD_DECISION_ENDPOINT } : {}),
    ...(id === 'cloudflare-clef' ? { accountId: selected && environment.DSCORD_DECISION_ACCOUNT_ID || environment.CLOUDFLARE_ACCOUNT_ID || '' } : {}) };
}
