# DSCord Central（中央服务器）

中央服务器只管三件事：账号、签发身份、服务器索引。它不存消息和文件，不转发聊天，也不持有任何 Matrix token。聊天服务器（Core + Synapse）接入一台中央，人和 Bot 都用中央账号登录聊天服务器。整体方案见项目文档《DSCord 中央身份与聊天服务器方案》。

已经完成：账号、账号规则、身份令牌、Bot 节点授权（第一期），聊天服务器只认中央账号（第二期，见下文“聊天服务器怎样接入”），服务器索引（第四期，见下文“服务器索引”）。

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
- `serverFetchUrls`：可选，`{ "聊天服务器 origin": "中央实际访问的地址" }`。中央所在网络访问不到某台聊天服务器的公开地址时（例如同一个 Compose 里），索引改从这里读它的公开页面。

配置文件不存在时，可以用环境变量 `DSCORD_CENTRAL_ISSUER`、`DSCORD_CENTRAL_REGISTRATION`、`DSCORD_CENTRAL_CLIENT_ORIGINS`（逗号分隔）、`DSCORD_CENTRAL_SERVER_FETCH_URLS`（逗号分隔的 `origin=地址`）在第一次启动时生成它；之后以文件为准，改环境变量不再生效。Compose 自带的 `central` 服务就是这样启动的。

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
| `GET /api/servers?q=&tag=&limit=` | 任何人（不用令牌，允许任意网页跨域） | 搜索服务器索引 |
| `POST /api/servers` | 人 | `{origin}` 认领一台聊天服务器，返回挑战码 `challenge`；同一个人再认领拿到同一个挑战码 |
| `POST /api/servers/:origin/verify` | 人 | 读取 `origin` 的公开页面，挑战码对得上就把这台服务器记在自己名下 |
| `GET /api/servers/mine` | 人 | 自己名下的服务器（含最近一次读取的结果）和还没验证的认领 |
| `POST /api/servers/:origin/refresh` / `DELETE /api/servers/:origin` | 服务器所属人 | 立即重新读取 / 从索引里删除 |

## 服务器索引

索引只记每台聊天服务器自己公开的介绍，不存它的成员、房间和消息。

- 登记：服务器管理员在中央认领服务器的 origin，拿到一个挑战码，把它写进聊天服务器的策略（管理后台“服务器目录”一步完成）。Core 随即在 `GET /.well-known/dscord/server` 公开这个挑战码、它信任的中央地址和自己的介绍。中央从这个 origin 读到页面、核对 `central` 是自己、挑战码和认领人的一致，就把认领人记为所属人。
- 为什么是中央去读，而不是聊天服务器推送：能在这个 origin 上放出挑战码，就证明管理员控制这个域名；聊天服务器也就不需要在中央持有任何凭据。后验证的人接手所属权，因为能改页面的人才是实际的控制者。
- 刷新：中央每小时重新读一遍所有登记过的服务器（读取不跟随跳转，页面上限 64 KB）。页面读不到、换了挑战码或改信任别的中央时，保留上次的介绍并记下错误；连续三天没读到成功的页面，就从搜索结果里消失，读到后自动恢复。管理员把“在中央搜索里显示”关掉，下次读取后也会从搜索里消失。
- 搜索：只列公开、三天内读到过的服务器，按人数排序。`q` 里的每个词都要出现在名称、简介或标签里（不分大小写）；`tag` 按标签精确筛选；`limit` 默认 20，最多 50。结果不含挑战码。

公开页面的格式（`schemaVersion: 1`）：

```json
{
  "schemaVersion": 1,
  "central": "https://id.example.org",
  "origin": "https://chat.example.org",
  "challenge": "dscord-server-…",
  "listed": true,
  "name": "机器人社",
  "description": "机械臂和小车",
  "tags": ["robots"],
  "join": "central-account",
  "members": { "people": 12, "bots": 3 }
}
```

`origin` 必须和登记的 origin 一致；`name` 最多 80 字，`description` 最多 500 字，`tags` 最多 10 个、每个最多 32 字。

## 身份令牌

身份令牌是 Ed25519 签名的 JWT（`alg: EdDSA`），声明包括 `iss`、`sub`（账号编号）、`aud`（聊天服务器 origin）、`iat`、`exp`、`jti`、`username`、`gid`（全局身份 ID）、`kind`（`human` 或 `bot`）、`name`（显示名），Bot 另有 `owner`（所属人的全局身份 ID）。聊天服务器用 `central/tokens.mjs` 的 `verifyIdentityToken` 按中央公钥、`issuer` 和自己的 origin 校验。一张令牌只对写明的那台聊天服务器有效。

撤销授权后，中央不再为那台服务器签发令牌；聊天服务器的本地会话是短期的，续期时要重新拿令牌，因此撤销会在一个会话周期内生效。

## 聊天服务器怎样接入

聊天服务器（Core）在 `core-config.json` 的 `identity.central` 写中央地址（初始化时取 `DS_GROUP_CENTRAL_URL`），并把自己的 `publicUrl` 当作令牌的 `aud`。Core 从中央读 `/.well-known/dscord/central` 和公钥，遇到新的签名密钥时重新读一次。容器网络里 Core 访问中央的地址和中央的公开地址不同时，用 `DS_GROUP_CENTRAL_FETCH_URL` 指定前者；令牌里的 `iss` 仍是公开地址。

- 登录：客户端在中央拿到身份令牌，交给 Core 的 `POST /api/session {identityToken}`，换回这台服务器的会话。Core 没有注册、密码登录和演示登录接口。
- 账号对应：中央用户名就是 Matrix 本地名。账号第一次登录时 Core 在 Synapse 建同名用户；已有的同名初始化成员由这个中央账号认领，之后只认它。
- Bot：Bot 的身份令牌带 `owner`，Core 据此把 Bot 记在所属人名下。Bot 节点用自己的会话调 `POST /api/bots/:id/connect` 拿节点配置，并报告它在哪个 DSH 宿主上（`native`）。
- 发现：`GET /.well-known/dscord/client` 的 `central.issuer` 告诉客户端去哪台中央登录，`auth.audience` 是申请身份令牌时要写的 `audience`。没有配置中央的 Core 返回 `central: null`，登录接口返回 503。
