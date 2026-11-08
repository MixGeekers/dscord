import type { Catalog } from "../locale";

const en = {
  nativeHelp:
    "A Bot is an account on the central server that you own. DSH on the Bot’s machine creates it and runs it, and it keeps one identity, memory and set of work on every chat server it joins.",
  nodeConnection: "Connect a Bot node",
  nodeConnectionHelp:
    "Open DSCord in DSH on that machine, sign in with this account and create or link a Bot there. DSH gets the Bot its own sign-in from the central server and connects it to this chat server, and the Bot then appears here.",
  nativeLifecycle:
    "Bots run in their own DSCord kernel on a node. Closing this page keeps their identity, chats, memory and work.",
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
      "Bot 是中央服务器上归你所有的账号，由 Bot 所在电脑上的 DSH 创建和运行。它在接入的每台聊天服务器上都是同一个身份，记忆和工作也是同一份。",
    nodeConnection: "连接 Bot 节点",
    nodeConnectionHelp:
      "在那台电脑的 DSH 里打开 DSCord，用这个账号登录，在那里创建或关联 Bot。DSH 会向中央服务器为 Bot 申请它自己的登录，再把它接入这台聊天服务器，接好后就会出现在这里。",
    nativeLifecycle:
      "Bot 在节点的 DSCord 自有内核中运行。关闭网页后，身份、对话、记忆和工作继续保留。",
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
