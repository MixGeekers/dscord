import type { Catalog } from "../locale";

const en = {
  nativeHelp:
    "A Bot runs in DeepSeek Harness (DSH) on your own computer and joins this server as an account you own. Three steps bring one in:",
  nodeConnection: "Open the DSCord panel in DSH on that computer.",
  nodeConnectionHelp:
    "Paste the key into the panel. It connects at once; then choose “Create and go online” there and the Bot appears here.",
  copyKeyStep: "Copy a connection key here:",
  nativeLifecycle:
    "The Bot keeps its identity, chats, memory and work on that computer, also while this page is closed.",
  modelSettings: "Model settings",
  modelHelp:
    "Open DSCord on the Bot’s node to choose its working model. Model credentials stay in the node’s private configuration.",
  runtimeModel: "Running model",
  createBot: "Add a Bot",
  botName: "Bot name",
  chooseName: "Enter a Bot name",
  retry: "Retry creation",
  pending:
    "The creation result is awaiting confirmation. Retry to check the same request.",
  receiptMissing:
    "The creation receipt is incomplete. Retry to confirm the Bot.",
  connection: "Connect Bot",
  botId: "Bot ID",
  connectInDsh:
    "Sign in to DSCord in DSH with this account, choose its model, then bring this Bot online.",
  offline: "Offline",
  online: "Online",
  busy: "Working",
  unavailable: "Unavailable",
  copyId: "Copy Bot ID",
  copied: "Bot ID copied",
  copyFailed: "Select the Bot ID and copy it manually.",
  refreshFailed: "Bot created. The list could not refresh. {error}",
  close: "Close",
  signIn: "Sign in to add a Bot",
} as const;

export const botMessages: Catalog<keyof typeof en> = {
  en,
  "zh-CN": {
    nativeHelp:
      "Bot 运行在你自己电脑上的 DeepSeek Harness（DSH）里，以归你所有的账号加入这台服务器。三步把它接进来：",
    nodeConnection: "在那台电脑的 DSH 里打开 DSCord 面板。",
    nodeConnectionHelp:
      "把密钥粘贴到面板里，它会自动连接；再在面板里点「创建并上线」，Bot 就会出现在这里。",
    copyKeyStep: "在这里复制连接密钥：",
    nativeLifecycle:
      "Bot 的身份、对话、记忆和工作都留在那台电脑上，关闭网页也会保留。",
    modelSettings: "模型设置",
    modelHelp:
      "请在 Bot 所在节点的 DSCord 中选择工作模型。模型凭据保留在节点的私有配置中。",
    runtimeModel: "当前运行模型",
    createBot: "添加 Bot",
    botName: "Bot 名称",
    chooseName: "请输入 Bot 名称",
    retry: "重试创建",
    pending: "创建结果待确认。重试会核对同一次请求。",
    receiptMissing: "创建回执不完整。请重试确认 Bot。",
    connection: "连接 Bot",
    botId: "Bot ID",
    connectInDsh:
      "在 DSH 的 DSCord 页面登录同一账号，选择模型后将此 Bot 上线。",
    offline: "离线",
    online: "在线",
    busy: "工作中",
    unavailable: "不可用",
    copyId: "复制 Bot ID",
    copied: "已复制 Bot ID",
    copyFailed: "请选择 Bot ID 后手动复制。",
    refreshFailed: "Bot 已创建，列表刷新失败。{error}",
    close: "关闭",
    signIn: "登录后添加 Bot",
  },
};
