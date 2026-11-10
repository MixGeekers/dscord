/** The page's own words, registered with DSH's locale service under one namespace. */
export const localeNamespace = "dscord.connection";

export const zh = {
  unknown: "未知",
  decisionTitle: "决策模型",
  decisionHelp:
    "Bot 靠它判断什么时候该开口。它和 Bot 回答用的模型是两回事，只保存在这台设备上，这台设备运行的 Bot 共用。",
  decisionDoesJoin:
    "设为「自然参与」的 Bot 没被 @ 时，靠它判断该接话、等一等，还是继续听。",
  decisionDoesTurns:
    "对方连发几条消息时，靠它判断是等对方说完、并进正在写的回答，还是分开回答。",
  decisionWithout:
    "没有它，Bot 只在被 @ 或私聊时回答，「自然参与」不起作用；连发的消息只能按固定时间等一下再答，分不清你有没有说完。",
  decisionMissing: "未配置",
  decisionDisabled: "已停用",
  decisionFailed: "验证失败",
  decisionUnchecked: "已配置，尚未验证",
  decisionReady: "运行正常",
  decisionSetup1: "准备一把决策服务的 API key，默认是 OpenAI 的 key。",
  decisionSetup2: "填在下面。模型和服务地址已填好默认值，用别的服务时再改。",
  decisionSetup3: "点「保存并验证」，这里会立刻问服务一次，告诉你能不能用。",
  decisionApiKey: "决策模型 API key",
  decisionKeyNeeded: "必填。只保存在这台设备，保存后不会再显示。",
  decisionKeyHelp: "已保存一把 key，不会再显示。留空则继续用它，填写则替换。",
  decisionModelName: "决策模型名",
  decisionModelHelp: "决策服务里的模型名。清空后恢复默认。",
  decisionEndpoint: "服务地址",
  decisionEndpointHelp: "Decisions 接口的完整地址。清空后恢复默认。",
  enableDecision: "启用决策模型",
  saveDecision: "保存并验证",
  decisionSaving: "正在验证…",
  decisionEdit: "修改设置",
  decisionSaved: "已保存，决策模型可以用了。",
  decisionSavedNoKey: "已保存，但还没有 API key，决策模型还不能用。",
  decisionSavedDisabled: "已保存。决策模型现在是停用的。",
  decisionSavedFailed: "已保存，但验证没有通过。",
  decisionErrorKey:
    "服务拒绝了这把 key（{code}）。检查 key 有没有填对、能不能用这个模型。",
  decisionErrorAddress: "服务地址不对，或服务里没有这个模型（{code}）。",
  decisionErrorLimit:
    "服务说请求太多或额度用完了（{code}）。稍后再点一次「保存并验证」。",
  decisionErrorProtocol:
    "服务有回应，但不是决策模型该有的回答（{code}）。检查地址是不是 Decisions 接口、模型名是否一致。",
  decisionErrorUnreachable:
    "连不上服务或等待超时（{code}）。检查网络和服务地址。",
  decisionErrorOther: "服务没有正常回答（{code}）。",
  decisionEndpointInvalid:
    "服务地址要以 http:// 或 https:// 开头，不能带账号密码或 # 片段。",
  decisionModelInvalid: "模型名不能为空，也不能有空格。",
  kernelConflict:
    "这台设备正在运行旧的 Bot 内核。请先停用旧插件，按迁移说明启用 DSCord。",
  model: "模型",
  title: "DSCord",
  pageLabel: "DSCord 连接",
  loginTitle: "连接 DSCord 账号",
  connectionKey: "连接密钥",
  login: "连接",
  loggingIn: "正在连接…",
  connectKeyInvalid: "连接密钥不完整，请从 DSCord 网页重新复制。",
  connectKeyUnknown: "连接密钥已用过或不存在，请在网页上重新生成。",
  connectKeyExpired: "连接密钥已过期，请在网页上重新生成。",
  statusOffline: "未上线",
  statusConnecting: "正在连接",
  statusOnline: "已上线",
  statusError: "连接失败",
  openWeb: "打开 DSCord 网页",
  refresh: "刷新",
  readStatus: "正在读取连接状态…",
  runtimeUnavailable: "Bot 运行环境暂不可用",
  account: "当前账号",
  logout: "退出登录",
  loggingOut: "正在退出…",
  emptyBots:
    "还没有 Bot。在 DSCord 网页点「添加 Bot」，它会自动出现在这里并上线。",
  configDirectory: "本机配置目录",
  requestHttp: "DSH 请求失败（HTTP {status}）",
  requestFailed: "操作失败，请重试",
  invalidStatus: "DSH 返回的连接状态不完整",
  requestTimeout: "请求超时，请刷新连接状态",
  connectionUnavailable: "无法连接 DSH，请检查宿主是否正在运行",
  updateTitle: "插件版本",
  updateCurrent: "当前版本 {version}",
  updateProtocol: "服务器节点协议 {protocol}",
  updateIncompatible: "当前插件不支持此服务器的节点协议，需要换到兼容的版本。",
  updateAvailable: "可以换到 {version}",
  updateLatest: "已是兼容此服务器的最新版本。",
  updateUnchecked: "连上服务器后检查兼容版本。",
  updatePolicy: "升级方式",
  policyAuto: "自动升级",
  policyNotify: "有新版本时提示",
  policyManual: "手动检查",
  updatePrerelease: "包含预发布版本",
  updateCheck: "检查更新",
  updateInstall: "安装 {version}",
  updateInstalling: "正在安装…",
  updateInstalled: "新版本已安装。",
  updateRestart: "新版本已安装，重启 DSH 后生效。",
  updateFailed: "安装失败：{error}",
  updateNotRegistry: "插件不是从 npm 安装的，请手动安装新版本。",
  notJoined: "还没有加入聊天服务器。在网页的「我的 Bot」里让它加入。",
  openChat: "去聊天",
  loginStep1:
    "在 DSCord 网页点「添加 Bot」，或打开「设置 → 账号 → 连接 DSH」。",
  loginStep2: "点「复制连接密钥」。",
  loginStep3: "回到这里粘贴，粘贴后自动连接。",
  keyPlaceholder: "在这里粘贴连接密钥",
  keyHint: "密钥 10 分钟内有效，只能用一次。",
  advanced: "更多设置",
  guideLabel: "开始使用",
  stepAccount: "连接账号",
  stepAccountHint: "粘贴网页上复制的连接密钥",
  stepDecision: "配置决策模型",
  stepDecisionHint: "在下面填 API key 并验证",
  stepBot: "添加 Bot",
  stepBotHint: "在 DSCord 网页点「添加 Bot」",
  stepOnline: "上线",
  stepOnlineHint: "Bot 自动上线，去聊天里 @ 它",
  stepDone: "已完成",
  deviceBots: "这台设备运行的 Bot",
  deviceBotsHelp:
    "Bot 的名字、职责、模型和加入哪些服务器，都在 DSCord 网页的「我的 Bot」里设置，这里几秒内自动跟上。",
  linked: "已连接。在网页上添加的 Bot 会自动出现在这里。",
  refreshing: "正在刷新…",
  centralUnreachable: "暂时连不上中央服务器，Bot 按上次的设置继续运行：{error}",
  policyAutoHelp: "Bot 空闲时自动安装兼容此服务器的最新版本。",
  policyNotifyHelp: "定期检查，由你决定何时安装。",
  policyManualHelp: "只在你点检查时查找新版本。",
};

export const en: Record<keyof typeof zh, string> = {
  unknown: "Unknown",
  decisionTitle: "Decision model",
  decisionHelp:
    "Bots use it to judge when to speak. It is separate from the model a Bot answers with, is kept only on this device, and is shared by the Bots this device runs.",
  decisionDoesJoin:
    "A Bot set to “Join naturally” uses it, when nobody mentions the Bot, to decide whether to join in, wait, or keep listening.",
  decisionDoesTurns:
    "When someone sends several messages in a row, it decides whether to wait for the rest, fold them into the answer being written, or answer each one.",
  decisionWithout:
    "Without it, Bots answer only when mentioned or messaged directly and “Join naturally” does nothing; messages sent in a row are answered after a fixed pause, with no sense of whether you have finished.",
  decisionMissing: "Not set up",
  decisionDisabled: "Turned off",
  decisionFailed: "Check failed",
  decisionUnchecked: "Set up, not checked yet",
  decisionReady: "Working",
  decisionSetup1:
    "Get an API key for the decision service. By default that is an OpenAI key.",
  decisionSetup2:
    "Enter it below. The model and address are filled in with the defaults; change them only for another service.",
  decisionSetup3:
    "Choose “Save and check”. The service is asked once right away, and this panel says whether it works.",
  decisionApiKey: "Decision model API key",
  decisionKeyNeeded:
    "Required. Stored only on this device and never shown again.",
  decisionKeyHelp:
    "A key is saved and is never shown again. Leave this blank to keep it, or enter a new one to replace it.",
  decisionModelName: "Decision model name",
  decisionModelHelp:
    "The model’s name at the decision service. Clear it to return to the default.",
  decisionEndpoint: "Service address",
  decisionEndpointHelp:
    "The full address of the Decisions endpoint. Clear it to return to the default.",
  enableDecision: "Use the decision model",
  saveDecision: "Save and check",
  decisionSaving: "Checking…",
  decisionEdit: "Change settings",
  decisionSaved: "Saved. The decision model is working.",
  decisionSavedNoKey:
    "Saved, but there is no API key yet, so the decision model cannot work.",
  decisionSavedDisabled: "Saved. The decision model is turned off.",
  decisionSavedFailed: "Saved, but the check did not pass.",
  decisionErrorKey:
    "The service refused this key ({code}). Check the key and that it may use this model.",
  decisionErrorAddress:
    "The address is wrong, or the service does not have this model ({code}).",
  decisionErrorLimit:
    "The service says there are too many requests or the quota is used up ({code}). Choose “Save and check” again later.",
  decisionErrorProtocol:
    "The service answered, but not the way a decision model does ({code}). Check that the address is a Decisions endpoint and the model name matches.",
  decisionErrorUnreachable:
    "The service could not be reached or took too long ({code}). Check the network and the address.",
  decisionErrorOther: "The service did not answer properly ({code}).",
  decisionEndpointInvalid:
    "The address must start with http:// or https:// and carry no credentials or # fragment.",
  decisionModelInvalid: "The model name cannot be empty or contain spaces.",
  kernelConflict:
    "An older Bot kernel is running on this device. Stop its plugin and follow the migration instructions to enable DSCord.",
  model: "Model",
  title: "DSCord",
  pageLabel: "DSCord connection",
  loginTitle: "Connect your DSCord account",
  connectionKey: "Connection key",
  login: "Connect",
  loggingIn: "Connecting…",
  connectKeyInvalid:
    "This connection key is incomplete. Copy it again from the DSCord web page.",
  connectKeyUnknown:
    "This connection key was already used or does not exist. Make a new one on the web page.",
  connectKeyExpired:
    "This connection key has expired. Make a new one on the web page.",
  statusOffline: "Offline",
  statusConnecting: "Connecting",
  statusOnline: "Online",
  statusError: "Connection failed",
  openWeb: "Open DSCord on the web",
  refresh: "Refresh",
  readStatus: "Loading connection status…",
  runtimeUnavailable: "The Bot runtime is currently unavailable",
  account: "Current account",
  logout: "Sign out",
  loggingOut: "Signing out…",
  emptyBots:
    "No Bots yet. Choose “Add a Bot” on the DSCord web page and it appears here and goes online by itself.",
  configDirectory: "Local configuration directory",
  requestHttp: "DSH request failed (HTTP {status})",
  requestFailed: "The operation failed. Please try again.",
  invalidStatus: "DSH returned incomplete connection status",
  requestTimeout: "The request timed out. Refresh the connection status.",
  connectionUnavailable: "Cannot reach DSH. Check that the host is running.",
  updateTitle: "Plugin version",
  updateCurrent: "Current version {version}",
  updateProtocol: "Server node protocol {protocol}",
  updateIncompatible:
    "This plugin does not speak the server’s node protocol. Switch to a compatible version.",
  updateAvailable: "{version} is available",
  updateLatest: "This is the newest version that works with this server.",
  updateUnchecked:
    "Compatible versions are checked once a server is connected.",
  updatePolicy: "Upgrades",
  policyAuto: "Upgrade automatically",
  policyNotify: "Tell me about new versions",
  policyManual: "Check by hand",
  updatePrerelease: "Include prereleases",
  updateCheck: "Check for updates",
  updateInstall: "Install {version}",
  updateInstalling: "Installing…",
  updateInstalled: "The new version is installed.",
  updateRestart: "The new version is installed. Restart DSH to use it.",
  updateFailed: "Install failed: {error}",
  updateNotRegistry:
    "This plugin was not installed from npm. Install the new version by hand.",
  notJoined:
    "Not on any chat server yet. Add it to one under “My Bots” on the web page.",
  openChat: "Open chat",
  loginStep1:
    "On the DSCord web page, choose “Add a Bot”, or open Settings → Account → Connect DSH.",
  loginStep2: "Choose “Copy connection key”.",
  loginStep3: "Paste it here. It connects as soon as you paste.",
  keyPlaceholder: "Paste the connection key here",
  keyHint: "A key works once, within 10 minutes.",
  advanced: "More settings",
  guideLabel: "Getting started",
  stepAccount: "Connect your account",
  stepAccountHint: "Paste the key copied from the web page",
  stepDecision: "Set up the decision model",
  stepDecisionHint: "Enter an API key below and check it",
  stepBot: "Add a Bot",
  stepBotHint: "Choose “Add a Bot” on the DSCord web page",
  stepOnline: "Go online",
  stepOnlineHint: "The Bot goes online by itself; mention it in a chat",
  stepDone: "Done",
  deviceBots: "Bots this device runs",
  deviceBotsHelp:
    "A Bot’s name, role, model and chat servers are set on the DSCord web page under “My Bots”. This device follows within seconds.",
  linked: "Connected. Bots you add on the web page appear here by themselves.",
  refreshing: "Refreshing…",
  centralUnreachable:
    "The central server cannot be reached right now. Bots keep running as last set up: {error}",
  policyAutoHelp:
    "Install the newest version that works with this server while Bots are idle.",
  policyNotifyHelp: "Check regularly and let you decide when to install.",
  policyManualHelp: "Look for new versions only when you check.",
};

export type MessageKey = keyof typeof zh;
export type Translate = (
  key: MessageKey,
  params?: Record<string, string | number>,
) => string;
