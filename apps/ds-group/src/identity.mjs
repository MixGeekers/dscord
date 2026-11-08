import { CentralTrust } from './central-trust.mjs';

const IDENTITY_CONTRACT_VERSION = '2.0.0';
const fail = message => { throw new Error(message); };
const forbidden = message => Object.assign(new Error(message), { status: 403, code: 'CLIENT_ORIGIN_DENIED' });

function identityOrigin(value, name, { secure = true } = {}) {
  let url;
  try { url = new URL(value); } catch { fail(`${name} must be an HTTP(S) origin`); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    fail(`${name} must be an HTTP(S) origin without credentials, path, query or fragment`);
  }
  const loopback = url.hostname === 'localhost' || url.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(url.hostname);
  if (secure && url.protocol !== 'https:' && !loopback) fail(`${name} requires HTTPS except on loopback`);
  return url.origin;
}

export function validateIdentityOptions(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('identity configuration must be an object');
  const { central, matrixUrl, clientOrigins = [] } = value;
  if (!Array.isArray(clientOrigins) || clientOrigins.length > 32) fail('identity.clientOrigins must be an array of at most 32 origins');
  return {
    ...(central === undefined ? {} : { central: identityOrigin(central, 'identity.central') }),
    ...(matrixUrl === undefined ? {} : { matrixUrl: identityOrigin(matrixUrl, 'identity.matrixUrl', { secure: false }) }),
    clientOrigins: [...new Set(clientOrigins.map(origin => identityOrigin(origin, 'identity.clientOrigins')))].sort() };
}

/** Public discovery, the central server this chat server trusts, and browser-origin policy. */
export class IdentityService {
  constructor({ accounts, setup, config, centralUrl }) { Object.assign(this, { accounts, setup, config, centralUrl }); }

  initialize() {
    const selected = validateIdentityOptions(this.config.identity ?? {});
    const coreUrl = this.config.publicUrl ? identityOrigin(this.config.publicUrl, 'publicUrl', { secure: false }) : null;
    const matrixUrl = selected.matrixUrl ?? identityOrigin(this.setup.publicHomeserverUrl || this.setup.homeserverUrl, 'public Matrix URL', { secure: false });
    if (selected.central && !coreUrl) fail('A chat server that trusts a central server needs its public Core URL (publicUrl)');
    this.options = { ...selected, matrixUrl };
    this.home = { serverName: this.accounts.serverName || null, coreUrl, matrixUrl };
    this.accounts.home = this.home;
    if (selected.matrixUrl) this.setup.publicHomeserverUrl = matrixUrl;
    this.central = selected.central ? new CentralTrust({ issuer: selected.central, audience: coreUrl, url: this.centralUrl || selected.central }) : null;
    return this;
  }

  /** The central server, or a refusal when this chat server has none configured. */
  trust() {
    if (!this.central) throw Object.assign(new Error('This chat server has no central server configured'), { status: 503, code: 'CENTRAL_UNCONFIGURED' });
    return this.central;
  }

  discovery() {
    return { schemaVersion: 2, contractVersion: IDENTITY_CONTRACT_VERSION, name: 'DSCord', home: this.home,
      central: this.central ? { issuer: this.central.issuer } : null,
      auth: { mode: 'central-identity-token', audience: this.home.coreUrl, sessionPath: '/api/session', mePath: '/api/me', logoutPath: '/api/logout', cookieCredentials: false },
      credentials: { type: 'matrix-access-token', coreOrigin: this.home.coreUrl, matrixOrigin: this.home.matrixUrl, remoteCore: 'forbidden', deploymentAdmin: 'forbidden' } };
  }

  cors(request, response, pathname) {
    const publicDiscovery = ['/.well-known/dscord/client', '/.well-known/matrix/client', '/api/client-config', '/api/bootstrap'].includes(pathname);
    if (publicDiscovery && ['GET', 'OPTIONS'].includes(request.method)) {
      if (request.headers.authorization || request.headers.cookie) throw forbidden('Public discovery requires omitted credentials');
      response.setHeader('Access-Control-Allow-Origin', '*');
      if (request.method === 'OPTIONS') response.setHeader('Access-Control-Allow-Methods', 'GET');
      return;
    }
    if (!pathname.startsWith('/api/')) return;
    const origin = request.headers.origin;
    if (origin === undefined) return; // CLI/node callers still need their normal authentication.
    let normalized;
    try { normalized = identityOrigin(origin, 'Origin', { secure: false }); } catch { throw forbidden('Invalid client Origin'); }
    // Without a configured public Core URL, the page's own host is the one browser origin.
    const localOrigins = !this.home.coreUrl && request.headers.host ? [`http://${request.headers.host}`, `https://${request.headers.host}`] : [];
    if (origin !== normalized || ![this.home.coreUrl, ...localOrigins, ...this.options.clientOrigins].includes(normalized)) {
      throw forbidden('This client origin is not allowed by the home server');
    }
    response.setHeader('Access-Control-Allow-Origin', normalized);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Range, X-Upload-Id');
    response.setHeader('Access-Control-Expose-Headers', 'Retry-After, Content-Disposition, Content-Length, Content-Range');
    if (request.method === 'OPTIONS') {
      const method = request.headers['access-control-request-method'];
      const headers = request.headers['access-control-request-headers']?.toLowerCase().split(',').map(value => value.trim()) || [];
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method) || headers.some(header => !['authorization', 'content-type', 'range', 'x-upload-id'].includes(header))) {
        throw forbidden('This cross-origin request method or header is not supported');
      }
    }
  }
}
