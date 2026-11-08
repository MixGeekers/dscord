import { createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID, sign, verify } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

// Identity tokens are compact JWTs signed with Ed25519 (EdDSA). A chat server
// verifies them with the central server's published JWKS; nothing else is shared.

const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const decode = part => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
export const IDENTITY_TOKEN_TTL_SECONDS = 300;

export async function loadSigningKey(filename) {
  try {
    const stored = JSON.parse(await readFile(filename, 'utf8'));
    return { kid: stored.kid, privateKey: createPrivateKey({ key: stored.jwk, format: 'jwk' }) };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const { privateKey } = generateKeyPairSync('ed25519');
  const stored = { kid: randomUUID(), jwk: privateKey.export({ format: 'jwk' }) };
  try { await writeFile(filename, JSON.stringify(stored) + '\n', { mode: 0o600, flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    return loadSigningKey(filename);
  }
  return { kid: stored.kid, privateKey };
}

export function publicJwks({ kid, privateKey }) {
  const { kty, crv, x } = createPublicKey(privateKey).export({ format: 'jwk' });
  return { keys: [{ kty, crv, x, kid, alg: 'EdDSA', use: 'sig' }] };
}

export function signIdentityToken(key, claims) {
  const header = encode({ alg: 'EdDSA', typ: 'JWT', kid: key.kid });
  const body = encode(claims);
  const signature = sign(null, Buffer.from(`${header}.${body}`), key.privateKey).toString('base64url');
  return `${header}.${body}.${signature}`;
}

function invalid(code) {
  return Object.assign(new Error(code), { status: 401, code });
}

/** For chat servers: the claims of a token this central issued for this audience, or an error. */
export function verifyIdentityToken(token, { jwks, issuer, audience, now = Date.now() }) {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3) throw invalid('IDENTITY_TOKEN_MALFORMED');
  let header;
  let claims;
  try { [header, claims] = [decode(parts[0]), decode(parts[1])]; }
  catch { throw invalid('IDENTITY_TOKEN_MALFORMED'); }
  if (header.alg !== 'EdDSA') throw invalid('IDENTITY_TOKEN_ALGORITHM');
  const jwk = jwks?.keys?.find(entry => entry.kid === header.kid && entry.kty === 'OKP' && entry.crv === 'Ed25519');
  if (!jwk) throw invalid('IDENTITY_TOKEN_KEY_UNKNOWN');
  const key = createPublicKey({ key: { kty: jwk.kty, crv: jwk.crv, x: jwk.x }, format: 'jwk' });
  if (!verify(null, Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'))) throw invalid('IDENTITY_TOKEN_SIGNATURE');
  if (claims.iss !== issuer) throw invalid('IDENTITY_TOKEN_ISSUER');
  if (claims.aud !== audience) throw invalid('IDENTITY_TOKEN_AUDIENCE');
  const seconds = Math.floor(now / 1000);
  if (!Number.isSafeInteger(claims.exp) || claims.exp <= seconds) throw invalid('IDENTITY_TOKEN_EXPIRED');
  if (Number.isSafeInteger(claims.iat) && claims.iat > seconds + 60) throw invalid('IDENTITY_TOKEN_NOT_YET_VALID');
  return claims;
}
