// The central server owns the account format. Chat servers and clients read the
// published rule; they never define their own.

// A username becomes the Matrix localpart on every chat server, so a central rule
// can only narrow the characters Matrix allows in a localpart.
export const MATRIX_LOCALPART = /^[a-z0-9._=\-/]+$/;
const MAX_LOCALPART = 64;

export const DEFAULT_USERNAME_RULE = Object.freeze({
  pattern: '^[a-z][a-z0-9._-]*$',
  minLength: 3,
  maxLength: 32,
  reserved: Object.freeze(['admin', 'root', 'system', 'dscord', 'central']),
});

function fail(message) {
  throw new Error(`usernameRule: ${message}`);
}

/** The rule from central configuration, checked once at start. */
export function usernameRule(input = {}) {
  const rule = { ...DEFAULT_USERNAME_RULE, ...input };
  if (typeof rule.pattern !== 'string' || !rule.pattern.startsWith('^') || !rule.pattern.endsWith('$')) fail('pattern must be anchored with ^ and $');
  let expression;
  try { expression = new RegExp(rule.pattern, 'u'); }
  catch (error) { fail(`pattern does not compile: ${error.message}`); }
  if (!Number.isSafeInteger(rule.minLength) || rule.minLength < 1) fail('minLength must be a positive integer');
  if (!Number.isSafeInteger(rule.maxLength) || rule.maxLength < rule.minLength || rule.maxLength > MAX_LOCALPART) {
    fail(`maxLength must be between minLength and ${MAX_LOCALPART}`);
  }
  if (!Array.isArray(rule.reserved) || rule.reserved.some(name => typeof name !== 'string')) fail('reserved must be a list of names');
  const reserved = [...new Set(rule.reserved.map(name => name.toLowerCase()))].sort();
  return Object.freeze({
    pattern: rule.pattern, minLength: rule.minLength, maxLength: rule.maxLength, reserved: Object.freeze(reserved),
    /** The stored (lowercase) username, or a reason it is refused. */
    check(value) {
      if (typeof value !== 'string') return { error: 'USERNAME_REQUIRED' };
      const name = value.trim().toLowerCase();
      if (name.length < rule.minLength || name.length > rule.maxLength) return { error: 'USERNAME_LENGTH' };
      if (!MATRIX_LOCALPART.test(name) || !expression.test(name)) return { error: 'USERNAME_CHARACTERS' };
      if (reserved.includes(name)) return { error: 'USERNAME_RESERVED' };
      return { username: name };
    },
  });
}

/** What chat servers and clients see. */
export function publicRule(rule) {
  return { pattern: rule.pattern, minLength: rule.minLength, maxLength: rule.maxLength, reserved: [...rule.reserved],
    charset: MATRIX_LOCALPART.source, caseInsensitive: true, immutable: true };
}
