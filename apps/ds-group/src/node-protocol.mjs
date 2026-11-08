import { readFileSync } from 'node:fs';

// The Core⇄Bot-node contract has its own version, separate from the product and
// kernel versions. A kernel (the DSH plugin) declares the protocol range it speaks;
// Core speaks exactly one version. A node whose range covers Core's version may
// run any newer kernel, so a server that stays on an old release still lets its
// nodes upgrade. Minor versions only add optional capabilities; a major change
// is incompatible. The hello exchange itself never breaks: its fields only grow.

/** The protocol this Core speaks. */
export const NODE_PROTOCOL = '1.0';
/** The protocol range this kernel speaks. Raising `max` is a kernel release; raising `min` drops old servers. */
export const KERNEL_PROTOCOL = Object.freeze({ min: '1.0', max: '1.0' });
/** Protocol 1.0 is the node API that existed before the hello exchange. A node that
 * names no protocol, and a server without the hello route, speak 1.0. */
export const BASELINE_PROTOCOL = '1.0';
/** Optional features Core offers at NODE_PROTOCOL. */
export const CORE_CAPABILITIES = Object.freeze(['kernel-control']);
export const HELLO_PATH = '/internal/node/hello';

const PACKAGE = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
/** The kernel version is the installed DSCord package version. */
export const KERNEL_VERSION = PACKAGE.version;

const PROTOCOL = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;

export function parseProtocol(value) {
  const found = typeof value === 'string' ? PROTOCOL.exec(value) : null;
  if (!found) throw Object.assign(new Error('Invalid node protocol version'), { code: 'PROTOCOL_INVALID' });
  return { major: Number(found[1]), minor: Number(found[2]) };
}

const order = (a, b) => (a.major - b.major) || (a.minor - b.minor);

/** Whether a kernel range covers one protocol version. */
export function supports(range, version) {
  const wanted = parseProtocol(version);
  return order(parseProtocol(range.min), wanted) <= 0 && order(wanted, parseProtocol(range.max)) <= 0;
}

/** Whether Core accepts a node that negotiated `version`: same major, nothing newer than Core. */
export function accepts(coreVersion, version = BASELINE_PROTOCOL) {
  let wanted;
  try { wanted = parseProtocol(version); } catch { return false; }
  const own = parseProtocol(coreVersion);
  return wanted.major === own.major && wanted.minor <= own.minor;
}

const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && !value.includes('\0');

/** A hello request, or null when it is malformed. Plain checks: this module also loads inside the DSH plugin, which has no zod. */
export function parseHello(input) {
  const kernel = input?.kernel;
  const range = kernel?.protocol;
  const capabilities = kernel?.capabilities ?? [];
  if (!text(input?.botId, 200) || !text(input?.nodeId, 200) || !text(kernel?.version, 64)) return null;
  if (typeof range?.min !== 'string' || typeof range?.max !== 'string' || !PROTOCOL.test(range.min) || !PROTOCOL.test(range.max)) return null;
  if (!Array.isArray(capabilities) || capabilities.length > 64 || !capabilities.every(item => text(item, 64))) return null;
  return { botId: input.botId, nodeId: input.nodeId, kernel: { version: kernel.version, protocol: { min: range.min, max: range.max }, capabilities } };
}

/** Core's answer to a hello. A 426 still names Core's protocol so the node can find a kernel that speaks it. */
export function answerHello(input, { protocol = NODE_PROTOCOL, capabilities = CORE_CAPABILITIES, serverVersion = KERNEL_VERSION } = {}) {
  const server = { version: serverVersion };
  if (!supports(input.kernel.protocol, protocol)) {
    return { status: 426, body: { code: 'PROTOCOL_UPGRADE_REQUIRED', error: 'This kernel does not speak the server protocol', protocol, server } };
  }
  return { status: 200, body: { protocol, capabilities: [...capabilities], server } };
}

export function protocolError(code, protocol, message) {
  return Object.assign(new Error(message), { code, protocol });
}

/** Node side: introduce this kernel to Core before any other node request. */
export async function hello({ coreUrl, nodeSecret, botId, nodeId, capabilities = [], fetchImpl = fetch, range = KERNEL_PROTOCOL, version = KERNEL_VERSION }) {
  const response = await fetchImpl(new URL(HELLO_PATH, coreUrl), {
    method: 'POST', redirect: 'error',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${nodeSecret}` },
    body: JSON.stringify({ botId, nodeId, kernel: { version, protocol: range, capabilities } }),
    signal: AbortSignal.timeout(10000),
  });
  let value = {};
  try { value = await response.json(); } catch { /* answered below by status */ }
  if (response.status === 426) {
    throw protocolError('PROTOCOL_UPGRADE_REQUIRED', value.protocol ?? null,
      `服务器使用节点协议 ${value.protocol ?? '未知'}，当前插件 ${version} 只支持 ${range.min}–${range.max}，请升级 DSCord 插件`);
  }
  if (response.status === 404) {
    // A server released before the hello exchange speaks the baseline protocol.
    if (!supports(range, BASELINE_PROTOCOL)) {
      throw protocolError('PROTOCOL_SERVER_TOO_OLD', BASELINE_PROTOCOL, `服务器使用节点协议 ${BASELINE_PROTOCOL}，当前插件 ${version} 已不再支持，请升级服务器或安装较早的插件`);
    }
    return { protocol: BASELINE_PROTOCOL, capabilities: ['kernel-control'], server: null };
  }
  if (!response.ok) throw Object.assign(new Error(value.error || `Core hello HTTP ${response.status}`), { code: value.code || 'HELLO_FAILED', status: response.status });
  if (!supports(range, value.protocol)) throw protocolError('PROTOCOL_UPGRADE_REQUIRED', value.protocol ?? null, '服务器返回的协议版本不在插件支持范围内');
  return { protocol: value.protocol, capabilities: Array.isArray(value.capabilities) ? value.capabilities : [], server: value.server ?? null };
}
