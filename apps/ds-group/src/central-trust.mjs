import { verifyIdentityToken } from '../central/tokens.mjs';

const KEY_REFRESH_MS = 30_000;
const unavailable = message => Object.assign(new Error(message), { status: 503, code: 'CENTRAL_UNAVAILABLE' });

/**
 * This chat server's view of its central server: discovery, signing keys and identity-token checks.
 * `url` is where this server reaches the central server when that differs from its public issuer,
 * as inside a container network.
 */
export class CentralTrust {
  constructor({ issuer, audience, url = issuer, fetchImpl = globalThis.fetch }) {
    Object.assign(this, { issuer, audience, url: url.replace(/\/$/, ''), fetchImpl });
    this.loadedAt = 0;
  }

  async #json(url) {
    let response;
    try { response = await this.fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(10_000) }); }
    catch { throw unavailable('The central server cannot be reached'); }
    if (!response.ok) throw unavailable(`The central server answered HTTP ${response.status}`);
    return response.json();
  }

  async #load() {
    const discovery = await this.#json(`${this.url}/.well-known/dscord/central`);
    if (discovery.issuer !== this.issuer || typeof discovery.domain !== 'string' || typeof discovery.jwksUri !== 'string') {
      throw unavailable('The central server published another identity');
    }
    const jwksUrl = new URL(discovery.jwksUri);
    const jwks = await this.#json(jwksUrl.origin === this.issuer ? `${this.url}${jwksUrl.pathname}` : jwksUrl.href);
    if (!Array.isArray(jwks?.keys)) throw unavailable('The central server published no signing keys');
    Object.assign(this, { discovery, jwks, loadedAt: Date.now() });
  }

  /** The claims of an identity token issued for this chat server, refetching keys once if the key is new. */
  async verify(token) {
    if (!this.jwks) await this.#load();
    try { return verifyIdentityToken(token, { jwks: this.jwks, issuer: this.issuer, audience: this.audience }); }
    catch (error) {
      if (error.code !== 'IDENTITY_TOKEN_KEY_UNKNOWN' || Date.now() - this.loadedAt < KEY_REFRESH_MS) throw error;
      await this.#load();
      return verifyIdentityToken(token, { jwks: this.jwks, issuer: this.issuer, audience: this.audience });
    }
  }

  /** `name@domain` from this central, as the Matrix user of the same name on this chat server. */
  localUser(globalId, serverName) {
    const at = typeof globalId === 'string' ? globalId.indexOf('@') : -1;
    if (at < 1 || globalId.slice(at + 1) !== this.discovery.domain) throw Object.assign(new Error('Unknown global identity'), { status: 401, code: 'IDENTITY_TOKEN_OWNER' });
    return `@${globalId.slice(0, at)}:${serverName}`;
  }
}
