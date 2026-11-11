# DSCord 实例管理后台

实例管理后台用于配置伙伴服务器、成员与房间准入、Bot 工作限制、管理员和审计。它使用独立的账号、会话和监听端口，普通聊天账号与房间管理员不自动获得实例管理权限。

## 启动和首次登录

先按[服务器部署](../deploy/README.md)初始化 Core 和 Synapse，再使用同一数据目录启动后台。以下目录是可替换示例：

```sh
npm ci --ignore-scripts
npm run build:admin
DS_GROUP_DATA_DIR=/absolute/path/to/core-data npm run admin:init
DS_GROUP_DATA_DIR=/absolute/path/to/core-data DS_GROUP_SYNAPSE_DIR=/absolute/path/to/synapse npm run admin:start
```

首次初始化创建 `owner`，且只允许尚无管理员的实例执行。未设置 `DS_GROUP_ADMIN_PASSWORD` 时，随机密码保存在 Core 数据目录的私有文件 `initial-administrator.json`，终端只返回文件路径。将凭据保存到密码管理器后可移除该文件。已有实例由当前 owner 在后台管理管理员。

Compose 部署已包含 `administration` 服务。初始化命令为：

```sh
docker compose --env-file deploy/.env -f deploy/compose.yaml exec administration node scripts/admin.mjs init
```

默认入口为 `http://127.0.0.1:18110`。直接运行可用 `DS_GROUP_ADMIN_HOST`、`DS_GROUP_ADMIN_PORT` 修改监听；Compose 只把管理端口映射到宿主回环地址。需要远程管理时，通过受控管理网络或单独的 HTTPS 反向代理访问，公共聊天代理不自动公开它。

## 权限和会话

| 角色 | 权限 |
| --- | --- |
| `owner` | 实例配置、应用策略、管理员管理和审计 |
| `operator` | 实例配置、应用策略和审计；不能增改管理员 |
| `auditor` | 只读查看 |

实例始终至少保留一个有效 owner。更改某位管理员的密码、角色或启用状态会撤销该管理员现有会话。管理会话最长 8 小时，空闲上限 1 小时；后台使用本实例签发的 Bearer 会话，不使用管理 cookie，也不开放跨域管理 API。普通 Matrix token 和其他实例的管理会话均不能登录本实例后台。实现依据见 [admin-auth.mjs](../src/admin-auth.mjs) 与 [admin.mjs](../src/admin.mjs)。

## 保存、应用和实际状态

策略分别记录伙伴服务器、完整成员 ID、精确房间、Bot 工作限制和实例设置。策略文件为 `DS_GROUP_GOVERNANCE_DIR/policy.json`；未指定时位于 Core 数据目录的 `governance/policy.json`。字段与校验见 [governance.mjs](../src/governance.mjs)。

保存使用 revision 比较，避免旧页面覆盖新配置。出现冲突时可以保留草稿，重新加载后核对。保存配置、应用房间变更、等待服务重启及运行中模块观察到新版本是不同状态。应用失败时查看各房间的错误；单次保存成功不表示所有房间和节点已经生效。

伙伴启用不会自动准入该服务器的全部账号。外部成员使用完整 Matrix ID，并受精确房间规则、实际邀请和 Matrix 权限约束。本服成员的加入事实仍由 Matrix 成员关系决定。普通聊天 token 只交给自己的归属 Core/homeserver，不用于登录外服 Core。

## 服务器目录

“服务器目录”决定别人怎么找到、怎么加入本服务器，和其他策略一样保存后生效：

- 怎么被找到：公开（能被关键词搜到，也能凭服务器号找到）、只能凭服务器号找到、不公开（新服务器的默认值）。改动在中央下次读取时生效（每小时一次，或再登记一次立即生效）。
- 怎么加入：任何中央账号都能直接加入（默认），或者只能凭邀请加入。只凭邀请时，从没在本服务器登录过的人要在登录框填邀请码；已经是成员的人不受影响；成员的 Bot 随所属人加入，不用邀请码。
- 名称、简介和标签：显示在搜索结果里。

页面下方的“邀请”可以生成和撤销邀请码。邀请码 7 天内有效、可以多人使用，撤销后立即失效；成员也能在聊天网页的“协作服务器”里自己生成邀请码和邀请链接（`?invite=邀请码`）。邀请码存在 Core 数据目录的 `invites.sqlite`。

登记到中央不需要中央账号：保存策略后点“登记到中央”，管理服务只把 `core-config.json` 里的 `publicUrl` 报给中央。Core 一直在 `/.well-known/dscord/server` 公开本服务器的介绍和它信任的中央，中央从那里读取页面。新服务器默认先进入中央的待审核队列，由中央管理员上架、驳回或封禁；中央回答的服务器号、状态和留言会记进策略，显示在这一页。再点一次“重新登记”会让中央立即重新读取并刷新状态，被驳回后再登记会重新进入审核。管理服务访问中央的地址和中央的公开地址不同时（Compose 内），用 `DS_GROUP_CENTRAL_FETCH_URL` 指定前者。中央这一侧的规则见[中央服务器说明](../central/README.md#服务器索引)。

## Bot 工作限制

“Bot 工作”配置限定本服 Bot、允许的发起者、房间和文件工具。当前跨服范围支持任务授权目录内的 `read`、`write`、`edit`、`read_image`，不开放跨服委派。服务器策略、Bot 所有者授权、节点能力和任务授权共同限制实际执行；保存策略不会给节点新增工具能力。

房间工作策略使用 `org.dscord.work_policy` v1。可信发布者为所属实例的 `@dscord-control:<authority>`，还须满足实际房间成员关系及事件权限。普通房间创建者不能仅凭管理权冒充该发布者。联邦复制可能延迟，应结合任务回执核对执行结果。

## 联邦和附件边界

发行配置固定 Synapse `1.164.2`，版本见 [Compose](../deploy/compose.yaml)。准入模块使用 Synapse 的成员回调与第三方事件回调，后者属于上游实验接口；升级 Synapse 时需要同时检查模块兼容性。模块控制本服准入和本服权威房间，不重写任意远端历史。撤权通过成员封禁和房间 ACL 协调，已复制的历史不会变成未披露。

Matrix ACL 按主机名匹配，不能独立隔离同一主机名上的不同端口；伙伴名单和完整成员 ID 仍精确记录端口。来源：[Synapse 准入回调](https://element-hq.github.io/synapse/latest/modules/spam_checker_callbacks.html)、[第三方事件回调](https://element-hq.github.io/synapse/latest/modules/third_party_rules_callbacks.html)、[Matrix server ACL](https://spec.matrix.org/latest/client-server-api/#mroomserver_acl)。

Core 的房间证明附件入口为 `GET /api/rooms/:roomId/attachments/:attachmentId[/metadata]?eventId=:sourceEventId`，使用当前账号、真实消息引用和本服政策判断读取权限。完整下载先写入私有临时文件，检查长度和 SHA256，再复核读取条件；Range 请求也先核验完整上游对象。它不承诺撤回已下载字节或使用户已知的 Matrix 媒体 URI 失效，Matrix 媒体读取另受其自身接口语义约束。

完整校验默认每文件 `256 MiB`、同时 `2` 项、最多排队 `16` 项、每请求 `5` 分钟，来自 [verified-media.mjs](../src/verified-media.mjs)。通过 `core-config.json` 的 `verifiedDownloadMaxBytes/verifiedDownloadConcurrency`，或 `DS_GROUP_VERIFIED_DOWNLOAD_MAX_BYTES/DS_GROUP_VERIFIED_DOWNLOAD_CONCURRENCY` 调整并重启 Core；与上传上限分别配置。预留相应临时磁盘空间。

## 管理 API

“服务器更新”提供版本检查、一键安装、维护时段、进度和历史；仅实例 owner 可以执行更新。更新期间自动重连，正在执行的任务先完成。部署前提与备份恢复语义见[服务器更新](../deploy/updates.md)。

API 仅由独立管理服务提供，不挂到 Core 的聊天监听器。

| 接口 | 用途 |
| --- | --- |
| `POST /admin-api/login`、`logout`，`GET /admin-api/me` | 本实例管理员会话 |
| `GET /admin-api/overview` | 身份、服务、应用状态和不含凭据的存储摘要 |
| `GET /admin-api/server-update` | 更新状态和历史 |
| `POST /admin-api/server-update/check`、`settings`、`apply`、`recover` | owner 检查、配置、安装及重试恢复 |
| `GET /admin-api/policy`、`PUT /admin-api/policy` | 读取及按 revision 保存策略 |
| `POST /admin-api/apply` | 应用指定 revision，返回各房间和服务状态 |
| `POST /admin-api/invite` | 邀请已批准的精确成员进入本服房间 |
| `POST /admin-api/directory/list` | `{username, password}` 用中央账号把本服务器登记到中央索引 |
| `GET /admin-api/invites`、`POST /admin-api/invites`、`DELETE /admin-api/invites/:code` | 列出、生成、撤销邀请码 |
| `GET /admin-api/administrators`、`PUT /admin-api/administrators` | 查看或管理实例管理员；仅 owner 可写 |
| `GET /admin-api/audit?before=SEQUENCE` | 分页读取审计，每页最多 100 条 |

备份与恢复须同时覆盖 Core、Synapse 和治理数据，方法见[部署指南](../deploy/README.md#备份和恢复)。在线复制单个 SQLite 文件不能代替完整备份。
