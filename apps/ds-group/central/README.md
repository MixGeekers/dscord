# DSCord Central（中央服务器）

中央服务器只管三件事：账号、签发身份、服务器索引。它不存消息和文件，不转发聊天，也不持有任何 Matrix token。聊天服务器（Core + Synapse）接入一台中央，人和 Bot 都用中央账号登录聊天服务器。整体方案见项目文档《DSCord 中央身份与聊天服务器方案》。

本目录目前实现第一期：账号、账号规则、身份令牌和 Bot 节点授权。聊天服务器接入中央、服务器索引在后续各期完成。

## 运行

```sh
npm run central
```

数据目录默认是 `.local/central/`，可用 `DSCORD_CENTRAL_DATA_DIR` 指定；监听地址用 `DSCORD_CENTRAL_HOST`（默认 `127.0.0.1`）和 `DSCORD_CENTRAL_PORT`（默认 `18200`）。配置文件是数据目录下的 `central-config.json`，或由 `DSCORD_CENTRAL_CONFIG_PATH` 指定：

```json
{
  "issuer": "https://id.example.org",
  "registration": "open",
  "usernameRule": { "minLength": 3, "maxLength": 32, "reserved": ["admin", "root", "system", "dscord", "central"] },
  "clientOrigins": ["https://client.example.org"]
}
```

- `issuer`：中央的公开地址，必须是 HTTPS 的裸 origin（本机调试可用 `http://localhost`）。
- `domain`：全局身份 ID 里 `@` 后面的部分，默认取 `issuer` 的主机名。
- `registration`：`open` 允许自助注册，`closed` 关闭。
- `usernameRule`：账号规则，见下。
- `clientOrigins`：允许跨域调用中央接口的网页客户端 origin。

数据目录里的 `signing-key.json` 是签名私钥（权限 `0600`），`central.sqlite` 是账号库。备份时两者都要保留；换掉私钥后，聊天服务器要重新读取公钥。

## 账号格式

账号规则由中央在配置里指定，并公开在 `GET /.well-known/dscord/central` 的 `usernameRule` 里。聊天服务器和客户端只读这份规则。

- 全局身份 ID 是 `用户名@domain`，例如 `alice@id.example.org`；在某台聊天服务器上的地址是 `@用户名:聊天服务器域名`。
- 用户名会直接当 Matrix 本地名用，所以中央的规则总是和 Matrix 本地名字符集（小写 a-z、0-9 和 `. _ = - /`）取交集：`pattern` 写得再宽，也收不进 Matrix 不接受的字符。`maxLength` 最多 64。
- 默认规则：3 到 32 个字符，小写字母开头，只含 a-z、0-9 和 `. _ -`。输入不分大小写，一律存小写。
- 用户名注册后不能改；账号注销后用户名也不回收。显示名可以改。
- 人和 Bot 共用同一个命名空间，是否 Bot 看账号类型。

## 接口

除注明外，接口用 `Authorization: Bearer <中央会话令牌>`。错误返回 `{ error, code }`。

| 接口 | 谁用 | 作用 |
| --- | --- | --- |
| `GET /.well-known/dscord/central` | 任何人 | 中央地址、账号规则、公钥地址、令牌有效期 |
| `GET /.well-known/jwks.json` | 聊天服务器 | 验证身份令牌的公钥 |
| `POST /api/register` | 人 | `{username, password, displayName?}` 注册并登录（`registration: open` 时） |
| `POST /api/login` / `POST /api/logout` | 人 | 密码登录 / 退出当前会话 |
| `GET /api/me` / `DELETE /api/me` | 人、Bot 节点 / 人 | 查看自己 / 注销（名下还有 Bot 时要先注销 Bot） |
| `POST /api/identity-tokens` | 人、Bot 节点 | `{audience, allowNew?}` 为某台聊天服务器（HTTPS origin）签发 5 分钟有效的身份令牌；第一次去某台服务器时要带 `allowNew: true`，否则返回 `GRANT_REQUIRED` |
| `GET /api/grants` / `DELETE /api/grants/:audience` | 人、Bot 节点 | 查看 / 撤销自己授权过的聊天服务器 |
| `POST /api/bots` / `GET /api/bots` / `DELETE /api/bots/:id` | 人 | 创建 / 列出 / 注销自己名下的 Bot |
| `GET /api/bots/:id/grants`、`DELETE /api/bots/:id/grants/:audience` | Bot 的所属人 | 查看 / 撤销 Bot 的服务器授权 |
| `GET /api/bots/:id/nodes`、`DELETE /api/bots/:id/nodes/:nodeId` | Bot 的所属人 | 查看 / 撤销 Bot 的节点 |
| `POST /api/device` | Bot 节点 | `{label?}` 开始设备码授权，返回 `deviceCode`、`userCode`（10 分钟有效） |
| `POST /api/device/approve` | Bot 的所属人 | `{userCode, botId}` 把这个节点授权给自己的 Bot |
| `POST /api/device/token` | Bot 节点 | `{deviceCode}` 换取 Bot 的节点会话；所属人批准前返回 `AUTHORIZATION_PENDING`，只能换一次 |

## 身份令牌

身份令牌是 Ed25519 签名的 JWT（`alg: EdDSA`），声明包括 `iss`、`sub`（账号编号）、`aud`（聊天服务器 origin）、`iat`、`exp`、`jti`、`username`、`gid`（全局身份 ID）、`kind`（`human` 或 `bot`）、`name`（显示名），Bot 另有 `owner`（所属人的全局身份 ID）。聊天服务器用 `central/tokens.mjs` 的 `verifyIdentityToken` 按中央公钥、`issuer` 和自己的 origin 校验。一张令牌只对写明的那台聊天服务器有效。

撤销授权后，中央不再为那台服务器签发令牌；聊天服务器的本地会话是短期的，续期时要重新拿令牌，因此撤销会在一个会话周期内生效。
