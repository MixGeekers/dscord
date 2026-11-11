/**
 * How a model reads a conversation. The node's own records keep Matrix IDs, name provenance and delivery receipts
 * for bookkeeping; a model needs who said what to whom, in order. People and messages become short references and
 * long text is cut. The decision model and a Bot's front both read conversations through this one view, and each
 * adds only what it alone needs (the decision model: how long ago; the front: who exactly, and when).
 */
export const TEXT_CHARS = 1200;
export const QUOTE_CHARS = 300;

/** Cut at a code point boundary and say how long the original was. */
export function clipText(value, max) {
  const text = typeof value === 'string' ? value : '';
  if (text.length <= max) return text;
  const end = /[\ud800-\udbff]/.test(text[max - 1]) ? max - 1 : max;
  return `${text.slice(0, end)}…（原文 ${text.length} 字，已截断）`;
}

export const list = value => Array.isArray(value) ? value : [];
export const bodyOf = message => message?.body ?? message?.text ?? message?.content?.body ?? '';
export const eventIdOf = message => message?.eventId || message?.source?.eventId || null;

/**
 * @param {object} options
 * @param {string|null} [options.selfId] the reading Bot's account
 * @param {boolean} [options.identity] list what establishes who each person is: the full account (names are only
 *   labels), the global identity behind it, a Bot's owner, and whether the server's directory knows the account
 * @param {(eventId: string) => string} [options.messageRef] a reference that is the same in every reading, for a
 *   reader that meets the same message again in later turns; without it messages are M1, M2… within one reading
 * @param {(account: string) => string} [options.personRef] the same for people: a P-number that stays with the
 *   account across readings, given when a person is first referred to; without it people are P1, P2… in roster order
 */
export function conversationView({ selfId = null, identity = false, messageRef, personRef } = {}) {
  const people = new Map();
  /** Current names first: a message keeps the label its sender had then, the roster says who they are now. */
  const enroll = (id, name, kind, record) => {
    const key = id || name;
    if (!key) return undefined;
    let entry = people.get(key);
    if (!entry) {
      entry = { key, ref: personRef ? undefined : `P${people.size + 1}`, name: name || id, ...(key === selfId ? { self: true } : {}) };
      people.set(key, entry);
    } else if (name && entry.name === key) entry.name = name;
    if (kind && kind !== 'unknown' && !entry.kind) entry.kind = kind;
    if (identity && id) {
      entry.id = id;
      if (record?.globalId) entry.gid = record.globalId;
      if (record?.ownerId) entry.ownerId = record.ownerId;
      if (record?.identitySource) entry.unverified = record.identitySource !== 'account-directory';
    }
    return entry;
  };
  const codeOf = entry => entry.ref ??= personRef(entry.key);
  const person = (id, name, kind, record) => {
    const entry = enroll(id, name, kind, record);
    if (!entry) return undefined;
    entry.mentioned = true;
    return codeOf(entry);
  };
  const entryOf = id => people.get(id);
  const table = ({ mentionedOnly = false } = {}) => {
    const shown = [...people.values()].filter(entry => !mentionedOnly || entry.mentioned);
    // A Bot's owner is part of who the Bot is.
    if (identity) for (const entry of [...shown]) {
      const owner = entry.ownerId && people.get(entry.ownerId);
      if (owner && !shown.includes(owner)) shown.push(owner);
    }
    for (const entry of shown) codeOf(entry);
    return Object.fromEntries(shown.sort((a, b) => Number(a.ref.slice(1)) - Number(b.ref.slice(1)))
      .map(({ key, ref, mentioned, ownerId, unverified, ...entry }) => [ref, { ...entry,
        ...(ownerId ? { owner: people.get(ownerId)?.ref || ownerId } : {}), ...(unverified ? { unverified: true } : {}) }]));
  };

  const refs = new Map();
  const number = message => {
    const id = eventIdOf(message);
    if (id && !refs.has(id)) refs.set(id, messageRef ? messageRef(id) : `M${refs.size + 1}`);
  };
  const numbered = id => refs.has(id);
  const refOf = id => refs.get(id) ?? (messageRef && id ? messageRef(id) : undefined);

  const message = (message, { chars = TEXT_CHARS } = {}) => {
    const sender = message?.source?.sender || {};
    const replyTo = message?.source?.replyTo || message?.replyTo;
    const attachments = list(message?.attachments).map(file => file?.name || file?.filename || 'file');
    const to = list(message?.to).map(id => person(id)).filter(Boolean);
    const from = person(sender.id || message?.senderId, message?.senderName || sender.name, sender.kind || message?.senderKind, sender);
    const ref = numbered(eventIdOf(message)) ? refs.get(eventIdOf(message)) : undefined;
    return { ...(ref ? { ref } : {}), ...(from ? { from } : {}),
      text: clipText(bodyOf(message), chars),
      ...(replyTo ? { replyTo: refOf(replyTo) || 'earlier' } : {}),
      ...(to.length ? { to } : {}),
      ...(attachments.length ? { attachments } : {}),
      ...(message?.withdrawn || message?.source?.withdrawn ? { withdrawn: true } : {}),
      ...(message?.kind ? { kind: message.kind } : {}) };
  };
  /** A message the current one answers or belongs under, when the listed messages do not already show it. */
  const quote = value => value?.body !== undefined && !numbered(value.source?.eventId)
    ? { from: person(value.source?.sender?.id, value.source?.sender?.name, value.source?.sender?.kind, value.source?.sender),
      text: clipText(value.body, QUOTE_CHARS) }
    : undefined;

  return { enroll, person, entryOf, table, number, numbered, refOf, message, quote };
}
