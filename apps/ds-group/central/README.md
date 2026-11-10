# DSCord Central（中央服务器）

中央服务器管四件事：账号、签发身份、服务器索引，以及每个人名下 Bot 的设置和运行它们的设备。它不存消息和文件，不转发聊天，也不持有任何 Matrix token。聊天服务器（Core + Synapse）接入一台中央，人和 Bot 都用中央账号登录聊天服务器。整体方案见项目文档《DSCord 中央身份与聊天服务器方案》。

已经完成：账号、账号规则、身份令牌、Bot 节点授权（第一期），聊天服务器只认中央账号（第二期，见下文“聊天服务器怎样接入”），服务器索引和中央管理面板（第四期，见下文“服务器索引”和“管理面板”）。

## 运行

```sh
npm run central
```

数据目录默认是 `.local/central/`，可用 `DSCORD_CENTRAL_DATA_DIR` 指定；监听地址用 `DSCORD_CENTRAL_HOST`（默认 `127.0.0.1`）和 `DSCORD_CENTRAL_PORT`（默认 `18200`）。配置文件是数据目录下的 `central-config.json`，或由 `DSCORD_CENTRAL_CONFIG_PATH` 指定：

```json
{
  "issuer": "https://id.example.org",
  "registration": "open",
  "listing": "review",
  "admins": ["alice"],
  "usernameRule": { "minLength": 3, "maxLength": 32, "reserved": ["admin", "root", "system", "dscord", "central"] },
  "clientOrigins": ["https://client.example.org"]
}
```

- `issuer`：中央的公开地址，必须是 HTTPS 的裸 origin（本机调试可用 `http://localhost`）。
- `domain`：全局身份 ID 里 `@` 后面的部分，默认取 `issuer` 的主机名。
- `registration`：`open` 允许自助注册，`closed` 关闭。
- `listing`：新登记的聊天服务器怎么处理。`review`（默认）等管理员审核后才上架，`open` 读到页面就直接上架。
- `admins`：中央管理员的用户名列表。管理员用自己的中央账号登录 `/admin` 管理面板。
- `registration` 和 `listing` 只是初始值：管理员在面板里改过之后，以面板里保存的为准（存在 `central.sqlite`）。
- `usernameRule`：账号规则，见下。
- `clientOrigins`：允许跨域调用中央接口的网页客户端 origin。
- `serverFetchUrls`：可选，`{ "聊天服务器 origin": "中央实际访问的地址" }`。中央所在网络访问不到某台聊天服务器的公开地址时（例如同一个 Compose 里），索引改从这里读它的公开页面。

配置文件不存在时，可以用环境变量 `DSCORD_CENTRAL_ISSUER`、`DSCORD_CENTRAL_REGISTRATION`、`DSCORD_CENTRAL_LISTING`、`DSCORD_CENTRAL_ADMINS`（逗号分隔的用户名）、`DSCORD_CENTRAL_CLIENT_ORIGINS`（逗号分隔）、`DSCORD_CENTRAL_SERVER_FETCH_URLS`（逗号分隔的 `origin=地址`）在第一次启动时生成它；之后以文件为准，改环境变量不再生效。Compose 自带的 `central` 服务就是这样启动的。

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
| `POST /api/connect-codes` | 人 | 生成 DSH 连接用的一次性代码（10 分钟有效）。聊天服务器网页把它和服务器地址一起编码成连接密钥 |
| `POST /api/connect-codes/redeem` | DSH 插件（不用令牌） | `{code, label?}` 用代码换取这个人的中央会话；只能换一次，过期返回 `CONNECT_CODE_EXPIRED`，未知或已用返回 `CONNECT_CODE_UNKNOWN` |
| `POST /api/bots` / `GET /api/bots` / `DELETE /api/bots/:id` | 人 | 创建 / 列出 / 注销自己名下的 Bot。创建时给 `{displayName, username?, role?, model?, effort?, deviceId?, servers?}`，不给 `username` 时由名字生成；返回的每个 Bot 带 `settings`（`role`、`model`、`effort`、`deviceId`、`servers`、`revision`）和 `runtime`（运行它的设备是否在线，以及设备最近报告的 `revision`、`model`、`error`、各服务器的连接状态；还没有设备时是 `null`） |
| `PATCH /api/bots/:id` | 人 | 修改名字和上面的设置，只改给出的字段，`revision` 加一。`model` 为空表示跟随设备默认，`servers` 是 Bot 要加入的聊天服务器（HTTPS origin，最多 32 个），`deviceId` 必须是自己的设备 |
| `GET /api/devices` | 人 | 自己连接过的 DSH：`id`、`label`、是否在线（30 秒内报告过）、它能用的模型目录和插件版本 |
| `POST /api/devices/:id/sync` | DSH 插件（用连接密钥换来的会话） | `{label, report}` 报告这台设备的模型目录、插件版本和各 Bot 的状态，返回分给它的 Bot 和设置。还没有设备的 Bot 归第一台报告的设备；同一台 DSH 换了人登录时，前一个人的 Bot 回到等待 |
| `DELETE /api/devices/:id` | 人、DSH 插件 | 移除设备：它名下的 Bot 等下一台设备接手，设备报告用的会话同时结束 |
| `GET /api/bots/:id/grants`、`DELETE /api/bots/:id/grants/:audience` | Bot 的所属人 | 查看 / 撤销 Bot 的服务器授权 |
| `GET /api/bots/:id/nodes`、`DELETE /api/bots/:id/nodes/:nodeId` | Bot 的所属人 | 查看 / 撤销 Bot 的节点 |
| `POST /api/device` | Bot 节点 | `{label?}` 开始设备码授权，返回 `deviceCode`、`userCode`（10 分钟有效） |
| `POST /api/device/approve` | Bot 的所属人 | `{userCode, botId}` 把这个节点授权给自己的 Bot |
| `POST /api/device/token` | Bot 节点 | `{deviceCode}` 换取 Bot 的节点会话；所属人批准前返回 `AUTHORIZATION_PENDING`，只能换一次 |
| `GET /api/servers?q=&tag=&limit=` | 任何人（不用令牌，允许任意网页跨域） | 搜索服务器索引；`q` 是 8 位数字时按服务器号精确查找 |
| `POST /api/servers` | 任何人（不用令牌） | `{origin}` 把一台聊天服务器报给索引。中央去读它的公开页面，返回 `{server: {origin, number, status, note, discovery}}`；再报一次会重新读取页面、返回当前状态 |
| `GET /api/admin/overview` | 中央管理员 | 待审、已上架等数量，账号数量，当前设置 |
| `POST /api/admin/settings` | 中央管理员 | `{registration?, listing?}` 修改注册和登记审核设置 |
| `GET /api/admin/servers?status=` | 中央管理员 | 索引里的全部服务器（含待审、驳回、封禁），可按状态筛选 |
| `POST /api/admin/servers/:origin/decision` | 中央管理员 | `{status: listed\|rejected\|banned, note?}` 上架、驳回或封禁，留言会随下次登记带回给该服务器 |
| `POST /api/admin/servers/:origin/refresh` / `DELETE /api/admin/servers/:origin` | 中央管理员 | 立即重新读取 / 从索引里移除（收回服务器号） |
| `GET /api/admin/accounts?q=&kind=&status=` | 中央管理员 | 按用户名或显示名查账号 |
| `POST /api/admin/accounts/:id/disable` / `enable` | 中央管理员 | 停用（立即结束它的所有会话，不能再登录或拿身份令牌）/ 恢复账号；不能停用自己 |

## 服务器索引

索引只记每台聊天服务器自己公开的介绍，不存它的成员、房间和消息。

- 登记：聊天服务器把自己的 origin 报给中央（管理后台“服务器目录”里点一次“登记到中央”），不需要任何中央账号。中央从这个 origin 读 `GET /.well-known/dscord/server`，页面写明信任的中央就是自己、`origin` 也对得上，就收下这台服务器。
- 为什么不需要账号：页面是从这个 origin 读到的，又点名信任这台中央，本身就说明控制这个域名的人愿意被登记。聊天服务器在中央不持有任何凭据，也没有“所属人”；要改介绍就改自己的策略，中央下次读取时更新；不想被找到就把发现方式改成 `hidden`。
- 审核：新服务器默认是“待审核”，中央管理员在管理面板里上架、驳回或封禁，可以附一句留言。`listing: open` 时读到页面就直接上架。被驳回的服务器再登记一次会回到待审核；被封禁的再登记会被拒绝（`SERVER_BANNED`），直到管理员解除封禁。只有已上架的服务器能被搜到。
- 服务器号：第一次登记时，中央随机分配一个 8 位数字作为服务器号（像 QQ 群号），之后一直不变；管理员把它从索引里移除后再登记会拿到新号码。
- 发现方式由聊天服务器自己决定（页面里的 `discovery`）：`public` 能被关键词搜到，也能凭号码找到；`number` 关键词搜不到，只能输入完整号码找到；`hidden` 搜不到也查不到号码，中央管理员仍能在面板里看到。
- 加入方式也由聊天服务器决定（`join`）：`open` 任何中央账号都能直接加入，`invite` 只接受凭邀请码加入。中央只把它显示在搜索结果里，真正的检查在聊天服务器上。
- 刷新：中央每小时重新读一遍待审和已上架的服务器（读取不跟随跳转，页面上限 64 KB）。页面读不到或改信任别的中央时，保留上次的介绍并记下错误；连续三天没读到成功的页面，就从搜索结果里消失，读到后自动恢复。发现方式的改动在下次读取后生效。
- 搜索：只列已上架、三天内读到过的服务器。`q` 是 8 位数字时先按号码精确查找（`public` 和 `number` 的服务器）；否则只搜 `public` 的服务器，`q` 里的每个词都要出现在名称、简介或标签里（不分大小写），按人数排序；`tag` 按标签精确筛选；`limit` 默认 20，最多 50。结果含服务器号和加入方式。

公开页面的格式（`schemaVersion: 1`）：

```json
{
  "schemaVersion": 1,
  "central": "https://id.example.org",
  "origin": "https://chat.example.org",
  "discovery": "public",
  "name": "机器人社",
  "description": "机械臂和小车",
  "tags": ["robots"],
  "join": "invite",
  "members": { "people": 12, "bots": 3 }
}
```

`origin` 必须和登记的 origin 一致；`name` 最多 80 字，`description` 最多 500 字，`tags` 最多 10 个、每个最多 32 字。

## 管理面板

中央自己在 `/admin` 提供管理面板（构建产物在 `dist/central-admin`，可用 `DSCORD_CENTRAL_ADMIN_WEB_DIR` 指定别的目录）。用配置里 `admins` 列出的中央账号登录，其他账号会被拒绝。面板有四页：

- 概览：待审核和已上架的服务器数、人和 Bot 的账号数、当前设置。
- 服务器：按状态（待审核、已上架、已驳回、已封禁）查看所有登记过的服务器，看它的介绍、发现方式、加入方式、人数和最近一次读取结果；可以上架、驳回、封禁、解除封禁、立即重新读取或移除，并给该服务器的管理员留言。
- 账号：按用户名或显示名、类型、状态查账号，停用或恢复。
- 设置：新服务器要不要先审核，账号注册是否开放。

管理员名单只能在配置文件里改，面板里不能增删。

## 身份令牌

身份令牌是 Ed25519 签名的 JWT（`alg: EdDSA`），声明包括 `iss`、`sub`（账号编号）、`aud`（聊天服务器 origin）、`iat`、`exp`、`jti`、`username`、`gid`（全局身份 ID）、`kind`（`human` 或 `bot`）、`name`（显示名），Bot 另有 `owner`（所属人的全局身份 ID）。聊天服务器用 `central/tokens.mjs` 的 `verifyIdentityToken` 按中央公钥、`issuer` 和自己的 origin 校验。一张令牌只对写明的那台聊天服务器有效。

撤销授权后，中央不再为那台服务器签发令牌；聊天服务器的本地会话是短期的，续期时要重新拿令牌，因此撤销会在一个会话周期内生效。

## 聊天服务器怎样接入

聊天服务器（Core）在 `core-config.json` 的 `identity.central` 写中央地址（初始化时取 `DS_GROUP_CENTRAL_URL`），并把自己的 `publicUrl` 当作令牌的 `aud`。Core 从中央读 `/.well-known/dscord/central` 和公钥，遇到新的签名密钥时重新读一次。容器网络里 Core 访问中央的地址和中央的公开地址不同时，用 `DS_GROUP_CENTRAL_FETCH_URL` 指定前者；令牌里的 `iss` 仍是公开地址。

- 登录：客户端在中央拿到身份令牌，交给 Core 的 `POST /api/session {identityToken}`，换回这台服务器的会话。Core 没有注册、密码登录和演示登录接口。
- 账号对应：中央用户名就是 Matrix 本地名。账号第一次登录时 Core 在 Synapse 建同名用户；已有的同名初始化成员由这个中央账号认领，之后只认它。
- Bot：Bot 的身份令牌带 `owner`，Core 据此把 Bot 记在所属人名下。Bot 节点用自己的会话调 `POST /api/bots/:id/connect` 拿节点配置，并报告它在哪个 DSH 宿主上（`native`）。
- 发现：`GET /.well-known/dscord/client` 的 `central.issuer` 告诉客户端去哪台中央登录，`auth.audience` 是申请身份令牌时要写的 `audience`。没有配置中央的 Core 返回 `central: null`，登录接口返回 503。
