const en = {
  signIn: "Sign in",
  signingIn: "Signing in",
  createAccount: "Create account",
  creatingAccount: "Creating account",
  backToSignIn: "Back to sign in",
  close: "Close",
  username: "Username",
  password: "Password",
  displayName: "Display name",
  showPassword: "Show password",
  hidePassword: "Hide password",
  rememberDevice: "Remember this device",
  signedOutLocally:
    "Signed out on this browser. The server could not confirm ending every session.",
  rememberHint:
    "Stay signed in for up to 30 days. Turn this off on a shared device.",
  rememberUnavailable:
    "This browser cannot remember your sign-in. You can continue in this tab.",
  usernameRequired: "Enter your username",
  passwordRequired: "Enter your password",
  displayNameRequired: "Enter your display name",
  rateLimited: "Too many sign-in requests. Try again shortly.",
  rateLimitedFor: "Too many sign-in requests. Try again in {seconds} seconds.",
  centralSignIn: "Sign in with your account on {host}.",
  centralRegister:
    "The new account lives on {host} and works on every chat server connected to it.",
  inviteCode: "Invitation code",
  inviteHint: "This server only takes invited people. Members need no code.",
  inviteRequired:
    "This server only takes invited people. Enter the invitation code a member gave you.",
  inviteInvalid:
    "This invitation code is wrong, expired or revoked. Ask a member for a new one.",
};

export const authMessages = {
  en,
  "zh-CN": {
    signIn: "登录",
    signingIn: "登录中",
    createAccount: "注册账号",
    creatingAccount: "注册中",
    backToSignIn: "返回登录",
    close: "关闭",
    username: "用户名",
    password: "密码",
    displayName: "显示名称",
    showPassword: "显示密码",
    hidePassword: "隐藏密码",
    rememberDevice: "记住此设备",
    signedOutLocally:
      "已清除此浏览器的登录状态，服务端未能确认所有会话已结束。",
    rememberHint: "最多保持登录 30 天。公用设备请取消勾选。",
    rememberUnavailable: "浏览器无法保存登录状态，仍可在当前标签页使用。",
    usernameRequired: "请输入用户名",
    passwordRequired: "请输入密码",
    displayNameRequired: "请输入显示名称",
    rateLimited: "登录请求过于频繁，请稍后重试。",
    rateLimitedFor: "登录请求过于频繁，请在 {seconds} 秒后重试。",
    centralSignIn: "使用 {host} 上的账号登录。",
    centralRegister: "新账号建在 {host} 上，接入它的聊天服务器都能用。",
    inviteCode: "邀请码",
    inviteHint: "本服务器只接受邀请加入。已经是成员的人不用填。",
    inviteRequired: "本服务器只接受邀请加入。请填写成员给你的邀请码。",
    inviteInvalid: "邀请码不对、已过期或已撤销。请向成员要一个新的。",
  } satisfies Record<keyof typeof en, string>,
};
