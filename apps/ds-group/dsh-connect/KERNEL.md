# DSCord 0.4.0-alpha.3 内核与宿主契约

`dscord-kernel` 是 DSCord 管理的 Bot 运行时，基于随包 DS-Bot 0.3.1 源码并包含 DSCord 修改。上游来源、完整性和许可保存在 [UPSTREAM.json](../vendor/ds-bot/UPSTREAM.json)、LICENSE 和 NOTICE；升级随 DSCord 发行进行，上游自身的更新器不替换本内核。

## 支持的宿主

固定 SDK 基线为官方 `@deepseek-ai/dsh@0.2.2-rc.1`。版本常量来自 [runtime-config.mjs](../scripts/runtime-config.mjs)，内核声明来自 [kernel-runtime.mjs](kernel-runtime.mjs) 的 `hostCompatibility`。Node 范围 `>=24.19.0 <25` 来自 [package.json](../package.json)。这是当前支持契约，不是对所有更新或更旧版本的兼容承诺。

内核使用原生 `sessionController.resolveAgent/create`、Session inbox、`sessions.flush`、`tools`、`systemPrompt`、`sessionTitle`、`workspaceRegistry` 和已认证的 shared connection 服务；附件通过宿主的 `attachments.admitPromptContent` 接纳。SDK 的消息、工具 schema 与生命周期接口必须可用，缺少时不能用伪造 Session 或兼容层冒充接入成功。

所需第三方运行库由 [runtime-dependencies.json](../dsh-plugin/runtime-dependencies.json) 和锁文件定义。启动器将 SDK 解析到实际宿主，将随包内核的其他运行库解析到私有依赖目录。模型和工具目录仍由宿主提供。

## 节点协议与插件版本

节点和 Core 之间的接口有自己的版本号（节点协议），和 DSCord 发行版本、插件（内核）版本分开，定义在 [node-protocol.mjs](../src/node-protocol.mjs)。Core 只说一个版本 `NODE_PROTOCOL`；插件声明自己能说的范围 `KERNEL_PROTOCOL {min,max}`，发布时写进 npm 清单的 `dscord.protocol`。协议号是 `主.次`：次版本只增加可选能力，主版本变化才不兼容。服务器不升级，节点也可以换到更新的插件，只要新插件的范围仍覆盖服务器的协议；兼容旧服务器的负担由插件承担。

- **握手**：节点在其他请求之前 `POST /internal/node/hello`，带 `botId`、`nodeId` 和 `kernel {version, protocol:{min,max}, capabilities}`。Core 能说时返回 `200 {protocol, capabilities, server:{version}}`，不能说时返回 `426 {code:"PROTOCOL_UPGRADE_REQUIRED", protocol}`，426 也告诉节点该找哪个协议。握手的请求和回答只增加字段，永远不改形状。
- **基线**：协议 1.0 就是握手出现之前的节点接口。没有握手路由（404）的旧服务器按 1.0 对待；心跳里不带 `protocol` 的旧节点也按 1.0 对待。
- **心跳**：每次心跳带协议和 `kernelVersion`。Core 只接受主版本相同、次版本不高于自己的节点，否则返回 426；`/api/status` 的节点记录里能看到每个节点的协议和插件版本，`core.nodeProtocol` 是 Core 自己的协议。
- **能力**：Core 在握手里列出它提供的可选能力（目前是 `kernel-control`）；节点只在服务器提供时启用对应功能。

插件按服务器的协议挑版本，不依赖 Core 认识新插件（[kernel-updates.mjs](kernel-updates.mjs)）。节点读取 npm 上 `dscord` 的全部版本，跳过已废弃的、渠道不符的（稳定版或包含预发布）、`dscord.protocol` 不覆盖服务器协议的、`engines.dsh` 不匹配当前 DSH 的，取最新的一个。当前插件兼容时只往新版本换；不兼容时换到兼容此服务器的最好版本，哪怕更旧，保证服务器不升级也不丢节点。安装交给 DSH 插件管理器（`installBundle`）；热重载下管理器拒绝覆盖已有依赖时，先移除本插件再装，失败时装回原来的版本。只有从 npm 安装的插件会被移动，本地路径或 git 安装只提示手动安装。

升级方式由节点所有者在连接页的「插件版本」里设定，保存在数据目录的 `kernel-updates.json`：

| 策略 | 行为 |
|---|---|
| `auto` | 发现兼容的新版本后，等所有 Bot 空闲（没有正在进行的一轮，也没有在跑或排队的工作者）时自动安装 |
| `notify`（默认） | 启动后和每 6 小时检查一次，服务器协议变化时立即检查，只提示 |
| `manual` | 只在所有者点「检查更新」时查找 |

连接页通过 `POST /api/dscord` 的 `kernel-update-status`、`kernel-update-check`、`kernel-update-policy`（`policy`、`channel`）和 `kernel-update-install` 操作这些设置；`status` 的 `kernelUpdates` 给出当前版本、服务器协议、是否兼容、可换到的版本、安装阶段和错误。

## 管理 API

DSH 内已认证、同源的 `POST /api/dscord/kernel` 接收 `{endpoint,payload}`，返回 `{ok,value}` 或 `{ok:false,error}`。它不是无需认证的公共 Core 入口。

| endpoint | 行为 |
|---|---|
| `kernel-info` | 只读运行时身份、版本、状态与数据目录 |
| `state` | Bot、Session 和工作状态；纯读取不创建 Bot 或问候 |
| `models` | 显式刷新模型目录 |
| `create-bot` / `update-bot` | 显式创建或修改同一内核的 Bot |
| `claim-bot` | 为尚未有所有者的旧 Bot 首次绑定，不能覆盖其他所有者 |
| `observe` / `attention-view` | 接纳已观察来源／读取有预算上下文 |
| `memory-profiles` / `memory-profile` | 只读人物与项目来源视图 |
| `migration-work` / `resume-migrated` | 查看／明确继续采用时保留的旧工作 |

`runtime` 包含 `id: "dscord-kernel"`、`version: "0.4.0"`、`upstreamVersion: "0.3.1"`、`apiVersion: 1`、实例身份、状态、home、记忆后端和迁移概要。实例身份随重启变化，Bot 和原生 Session 身份不因此更换。

`create-bot` 接受 `name/role/model/main/owner/source/requestId/greet`。首个显式创建的 Bot 默认成为 Main；`greet:false` 仅省略问候生成，仍创建 Session 和工具。相同请求标识、所有者与内容复用持久回执，内容变化拒绝。调用方应保留原请求标识来核对丢失回执，不能不断换新标识重建同一 Bot。

模型与工具工作使用原生 Agent inbox 和消息接纳流程。来源保留稳定发送者、种类、transport、room、event 与 request；人类和 Bot 的实际输入与工具／后台上下文分开。收到来源不代表已经理解、完成任务或送达结果。

## 前台、程序核心和工作者

连接到 DSCord 的每个 Bot 分成三部分。前台是 Bot 原有的原生 Session，只保留沟通、回忆、读房间、派活和管自己的工具（`dispatch_work`、`task_join`、`task_status`、`task_cancel`、`task_note`、`ask_bot`、`read_room`，以及记忆、日程和改自己名称头像的 `update_profile`），其他工具在前台被拒绝，查网页也交给工作者。每件事只有一种做法：原生宿主自己的 Bot 通道、团队和群（`message_bot`、`list_bots`、`post_to_group`、`group_relay`、`read_group_chat`、`read_own_chat`、`create_bot`、`update_bot`、`stop_bot`、`create_group`、`update_group`、`delete_group`、`group_goal`）在前台和工作者里都被拒绝：找别的 Bot 用 `ask_bot`，有哪些 Bot 看 `contacts`，群就是 Matrix 房间、里面的消息用 `read_room` 读，Bot 改自己的名称和头像用 `update_profile`（连接插件用 Bot 自己的中央会话调 `PATCH /api/me` 和 `/api/me/avatar`，几秒内同步到各聊天服务器和本机 Bot），其余设置由所属人在网页上管理。桌面卡片工具（`ask_user`、`ask_user_question`、`show_view`）在前台和工作者里都被拒绝：聊天里没人看得到卡片，一轮停在卡片上也没有可发的回复；前台把问题直接写在回复里，工作者用 `work_ask`。前台一轮正常结束却没有回复文字（例如停在某个工具上）时，桥接层提示它一次写出回复；再次没有回复文字就按空回复结束这次请求（记为失败），不会占住节点队列直到超时。程序核心是 `dsh-connect/work-core.mjs`，不调用模型，每个原生 Bot 一个：Bot 连着几台聊天服务器，各台的连接都在同一个核心里占一个席位（该服务器上的 Bot 账号和那里的通讯录），任务台账存在 `bots/<原生 Bot ID>/work.json`，任务记下请求是从哪个账号进来的（`origin.botId`），结果从同一台服务器交回，那台服务器暂时没连上就等它连上再交；核心维护任务台账、并发槽位（默认 3 个）、超时（默认 60 分钟）、取消、补充说明和交付文件核对。工作者是每个任务新建的一个 Session 和目录（连接数据目录下 `bots/<原生 Bot ID>/workers/<任务 ID>/`），有完整工具，只能用 `work_report` 汇报、用 `work_ask` 提问，读房间里的聊天原话和前台用同一个 `read_room`。

前台规则对 Bot 原生 Session 的每一轮都生效；连接建立时即生效，不等第一条房间消息。前台怎么工作的说明（`src/front-prompt.mjs` 的 `FRONT_RULES`）是系统提示的一部分：DSCord 服务着的 Bot，身份段里用它代替原生团队规则（那些规则讲的 `message_bot`、`update_bot`、`list_bots` 和原生群在 DSCord 里都被拒绝），每条消息不再重复这些说明。

前台和工作者的每次模型调用只带它们能用的工具：会被拒绝的工具（原生团队和群、桌面卡片、前台之外的工作工具、工作者不该用的前台工具）不出现在发给模型的工具列表里，核心在 `llm/stream` 上把它们去掉。工具说明每次调用都要整份重发，模型看到了还会去试，白走一步；模型仍然叫出这些名字时照旧拒绝并说明该怎么做。

### 前台每一轮读到什么

前台的 Session 是长期的：每一轮收到的文字都留在上下文里，之后每次调用模型都要再发一遍，直到宿主压缩对话；压缩时宿主只逐字保留每条消息的前 4000 个字符。所以一轮的文字（`frontMessage`）只有两行：第一行 `DSCORD_REQUEST=<请求标识的摘要>`，第二行一段 JSON，按下面的顺序：

- `room`：房间名、种类、话题；第一次读这个房间时带创建者，超过 12 人的房间只写人数。
- `msg`：要回答的消息，紧跟在 `room` 后面、在整段文字的开头，压缩后仍然留得住。`merged` 是同一个人紧接着发来、还没回复的前几条。`quoted`、`threadRoot` 是它回复的消息和所在话题的第一条，`history` 里已经有时不重复。
- `people`：这一轮涉及的人和 Bot。键是代号（`P1`、`P2`…），其余地方只用代号指人。每个人带当前显示名 `name`、完整账号 `id`、种类 `kind`，Bot 带主人 `owner`，有跨服务器身份的带 `gid`，服务器账号目录里查不到的标 `unverified`。身份只由账号确定，名字只是标签；第一次读一个不超过 12 人的房间时列出全部成员，之后只列这一轮提到的人。
- `history`：这个房间里这个 Session 还没看过的消息。每条有 6 位消息编号 `ref`（由事件 ID 算出，各轮各房间不变）、说话人、时间、正文，以及有的时候才出现的 `replyTo`、`to`、`as`（当时的显示名）、`for`（Bot 替谁转述）、`edits`、`thread`、`withdrawn`。正文超过 1200 字截断并注明原长。
- 只在需要时出现的：`replyGoesTo`（这一轮的回复发给原请求者）、`participationOnly`、`seenBefore`、`earlierOmitted`、`historyGap`、`withdrawn`（看过后被撤回的消息）、`contacts`、`openRequests`、`files`、`workResults`、`warnings`。

投递回执、名字来源、事件 ID、回复路由和注意力台账这些记账用的字段不进前台，留在节点记录和记忆里；回复发到哪里由节点按请求决定，不靠前台复述。

一个 Session 对一条房间消息只读一次。`history` 按估算的 token 预算（`HISTORY_TOKEN_BUDGET`，默认 3000，按一个中文字一个 token、三个其他字符一个 token 估，偏保守）从最新往回装，装不下的计入 `earlierOmitted`，至少列一条。每个账号的代号、每个房间给它看过哪些消息，记在核心的 `work.json`（`reading`）里；一个 Bot 在几台服务器上共用这一份，所以一个代号在整个 Session 里、在哪个房间都指同一个账号。一轮的文字给出的代号当时就记下，之后读到的任何内容都接着用，不会把同一个代号再发给别人；这一轮给房间看了哪些消息，在前台真正接下这一轮时才记入，被取消、没送达或换了 Session 的一轮不算读过。宿主压缩了对话（`compaction/summary`）之后，各房间重新读一次，代号不变；换了新的分段（part）就从头开始。能请的 Bot（`contacts`）只在名单和上次给这个房间看的不一样时列出。

每次请求在 `native-bridge.json` 的 `prompt` 里记下这一轮文字的字符数、估算 token 数、列出的历史条数和省略条数；模型返回的实际用量在同一条记录的 `calls[].usage` 里。

工作者汇报完成时，核心核对列出的文件或 `outputs/` 下的文件（同名同 SHA-256 的只交付一次），然后不经前台，直接把结果回复到原消息并附上文件：完成时是工作者的 `reply`（按请求者的口径写，原样发出；技术细节写在只给前台看的 `summary` 里，`outputs/` 以外的文件不交付；工作者没列 files、`outputs/` 也为空，而工作目录里写了文件时，核心先退回一次并列出这些文件，再次不带文件的汇报才按不交付文件处理。前台派工时写明 `audience`；对方不该看到技术内部信息时设 `plain`，核心会退回带堆栈、异常类型、类名.方法名、源码位置或日志原文的 `reply` 和交付文本文件，也会退回在说明“删掉/没写入/取舍”的 `reply`：筛掉了什么只写进 `summary`），失败时说明没有完成，宿主重启后结果不确定时只说明不确定、不自动重做。这样结果不排在对话后面，也不会被前台改写或重做。另一条消息要的是已有任务在做或做完的事时，前台用 `task_join` 把它登记为又一位请求者（任务的 `followers`），任务结束时核心把结果分别回复到每条请求消息（台账里为后来者另存一份 `<任务 ID>-<序号>`），已结束的任务立刻回复；加入时可写这位请求者的 `audience` 和 `plain`，`plain` 的请求者收不到带技术内部信息的交付文本文件，reply 里带这类内容的行也会去掉；`notifiedOrigins` 记录已交付到第几位，重启后从这里继续。加入的那一轮算作受理（`dispatched`），对另一个 Bot 的请求只发确认，不当作结果。要的东西是本 Bot 已经委托给其他 Bot、还没回来的事时，这一轮消息里的 `openRequests`（通讯录里未返回的外发往来，含当时的请求内容和为谁而问）让前台看到它，前台再用 `ask_bot` 请同一个 Bot，对方用 `task_join` 并进同一个任务，两条返回链各自回到自己的原消息。已交付的结果记在台账的 `frontNotes` 里，前台下一轮在 `workResults` 中看到一次。工作者的提问（`work_ask`）仍交给前台，由前台问对方或用 `task_note` 转达；答复到达前核心拒绝该任务交付，工作者一轮结束等答复也不算漏报。`task_note` 在工作者正忙时插进它正在进行的一轮（steer），空闲时作为新一轮；工作者读到之前同样不能交付。工作者的权限申请没有人回应，核心把它的审批策略设为 `never`，申请会被直接拒绝，任务不会卡在等审批上；要改工作目录以外的文件时，工作者把改好的版本放进 `outputs/` 交付。工作者一轮结束却没有汇报，会被提醒一次，再不汇报就记为失败。任务状态的每次迁移记录在任务的 `events` 里，当前工作者和队列出现在节点 kernel 状态的 `work.workers` 与 `work.queue`。宿主重启时未结束的任务记为 `unknown`，作为失败交回（对另一个 Bot 的请求是 `task.failure`），不会自动重做：派工必须有一条要回复的消息，宿主自己恢复的那一轮没有，因此会被拒绝。

同一个人在同一房间连续发来的消息由节点合并给前台：前台还没开始回答时，排在后面的几条一起交给前台，前台在 `msg.merged` 里看到前几条，自己判断是一句话拆成几条还是几件事。判断模型（与自然发言共用）决定何时开口：`WAIT` 表示对方还没说完，再等最多 6 秒；`REPLY` 表示现在回答；前台回答途中又来一条时，`JOIN` 表示它和正在回答的是一回事，节点停下这次回答，把几条合起来重新回答，`REPLY` 则等这次答完再单独答。只读工具之外已经动手（例如派了工）的回答不会被打断。没有配置判断模型时，节点等对方最后一条消息过去 2 秒再回答，回答途中的追加消息按 `JOIN` 处理。

Core 的 owner 管理接口通过节点通道访问本内核；网页不接收节点模型凭据。[人物和来源视图](../memory/当前上下文与回顾.md)

### 前台和工作者自己读房间（`read_room`）

一轮的文字只带这个房间里还没看过的最近消息。更早的消息、别的房间在说什么、房间里有谁，前台和工作者用同一个工具 `read_room`（`work-core.mjs` 的 `readRoom`）自己去看：

- 能读的范围是 Bot 自己的账号所在的每一个房间，包括它在别的聊天服务器上的账号所在的房间，和这一轮是谁请它看的无关：不核对请求者是不是那个房间的成员。Bot 和人一样，自己在的房间自己能看；看到的内容怎么用由 Bot 自己判断。
- 读的是各台服务器的节点在本机存下的消息（`src/room-reader.mjs` 读 `NodeStore`），也就是 Bot 加入房间之后收到的，不向服务器补取加入之前的历史。Bot 已经离开的房间不能读。
- 参数：`room`（`list=rooms` 给出的 6 位房间 id、完整房间 ID，或只对应一个房间的名字；不填是这一轮请求所在的房间，工作者是原始请求所在的房间）、`before`（消息编号，读这条之前的）、`start`（消息编号，从这条读起往后读；或上一页结果里的 `next`）、`list`（`rooms` 列出所在的全部房间，`members` 列出房间的全部成员）。`before`、`start` 不带 `room` 时，编号先在这一轮的房间里找，再到其他房间里找。
- 结果和一轮的文字是同一套写法：`room`、`people`（同一套代号）、`history`（同样的行和消息编号，`at` 是带日期的 UTC 时间），以及 `seenBefore`、`earlierOmitted`、`historyGap`、`withdrawn`；往后读的一页没读完时带 `laterOmitted` 和 `next`。读到的编号可以直接填回 `before`、`start`，也和之后各轮里的编号一致。
- 一页不超过 `HISTORY_TOKEN_BUDGET`（估算 3000 token）和 `READING_CHARS`（8000 字符），装不下的计入 `earlierOmitted` 或 `laterOmitted`。8000 这个数来自宿主：DSH 在上下文吃紧时会把超过 8192 字符的工具结果裁掉中间（只留开头 4096 和结尾 1024 字符），而且不发 `compaction/summary`，超过这个长度，阅读记录里算读过的消息就可能已经不在上下文里。房间列表和成员列表同样分页（`roomsOmitted`、`membersOmitted` 和 `next`）。
- 不带 `before`、`start` 时读最新的一页；这个 Session 读过的房间只列出之后的新消息，没有新消息就只回一句话。读到房间最新一条的一页记入阅读记录，之后的一轮和下一次读取都从它后面接着列；`before` 往回翻的一页不记。前台的记录就是每一轮用的那一份（`work.json` 的 `reading`），只有 Bot 当前的 Session 读的才写进去；工作者每个任务一份，只在内存里，任务结束就丢弃，工作者的 Session 被压缩后各房间重读。
- 分工：`read_room` 按时间顺序读原话；不知道在哪个房间、什么时候说的，按内容找用记忆的 `recall`、`raw_source_query`。整理一长段聊天记录这类要翻很多页的事，前台派给工作者去读，不占前台的上下文。

## 单实例和原目录采用

默认 Bot home 为实际 DSH home 下的 `bot/`。同一 home 只有一个持有目录租约的运行内核；检测到旧 `/api/bot` 服务或已持有的锁时返回 `DSCORD_KERNEL_CONFLICT`。先停止旧 `ds-bot` 插件或占用进程，再重载 DSCord，不同时运行两个写入者。

首次采用保存 `migrations/dscord-0.4.0/` 快照和 `dscord-kernel.json`。原 state、inflight、Bot ID、Session、记忆目录原位保留，不合并另一个 home 的历史。未知或损坏的数据版本阻止启动。

采用时的不明旧工作保留在 `migrationHeld`，不自动重投；先检查 `migration-work`，再按需要明确恢复。`unknown` 仍是结果不确定，不是完成或未执行的证明。停止宿主会等待工作与记忆后台收尾后释放租约。

## 接入边界

DSCord 的聊天入口是 Matrix。吸收的其他 IM adapter 源码不等于提供了相应的产品配置入口或服务支持。工具、任务、连接器和本地 CLI 能力仍受宿主实际安装、权限与用户设置约束。

健康接口、源码/SDK 契约检查不证明模型能正确聊天、回忆或完成文件任务。模型能力、外部连接器与部署网络须按实际配置使用。[安装与运行](../deploy/kernel-runtime.md)

## 通讯录

每个 Bot 有一本自己的通讯录（`src/contact-book.mjs`，存在连接数据目录下 `bots/<原生 Bot ID>/contacts.sqlite`），Bot 在几台聊天服务器上都共用这一本，路由只查它，不再各处猜：

- 联系人以全局身份 ID（`用户名@中央域名`，来自聊天服务器 roster 的 `globalId`）为键，这也是记忆里人物档案的键；同一个人在几台服务器上各有一个 Matrix 账号，都记在这个联系人名下。服务器给不出全局身份的账号，以它的 Matrix ID 作身份。某人是谁、偏好什么、能做什么只记在人物档案里，通讯录不另记。
- 房间和 Matrix 往来属于某一台服务器，节点通过 `on()` 按自己在那台服务器上的账号看这本通讯录：共同房间、`reach` 和 `ask_bot` 都只看这台服务器，请求发给对方在这台服务器上的账号；对方在这里没有账号就联系不上。前台在一轮文字的 `contacts` 里看到的 `id` 是对方在这台服务器上的账号，`ask_bot` 的 `to` 填它。还没返回的外发请求按发出的服务器列出。
- 共同房间来自房间 roster（只有成员读得到）和时间线里的成员变化；同一个 DSH 里的 Bot 由宿主告知（`work-core.mjs` 的 `localBot`），没碰过面也是联系人。Bot 之间的请求一律走 Matrix：`reach` 为 `room` 表示有共同房间，为 `direct` 表示没有，核心发请求时开一个私聊房间并邀请对方（对方节点自动加入），之后的请求沿用这个房间。前台在一轮文字的 `contacts` 里看到能请的 Bot（名单和上次给这个房间看的不一样时才再列一次），不在其中的 Bot 联系不上。
- 跨节点受托时，前台这一轮如果派了工，它的回复只是受理（`reply` / `ack`，不唤醒对方），不算结果；工作者的结果作为对原请求的 `task.result` 交回请求方 Bot，带原任务号和来源链。
- `ask_bot` 是找别的 Bot 的唯一方式，不管这一轮是在替人还是替另一个 Bot 办事：前台写 `to`（完整 ID、指向它的 Matrix 链接，或通讯录里只对应一个 Bot 的名字）、自足的 `body`，以及最终读者的 `audience`、`plain`（并进请求内容）。核心把请求记在这一轮上，这一轮正常结束时随回复一起交给节点（一轮最多 3 个、同一个 Bot 一次）；没正常结束的一轮不发。节点把每个请求作为 `task.request` 发到双方都在的房间（来源房间优先），没有就开私聊房间；开不了时在回复里如实说明这件事没交出去，发送彻底失败时在原消息下告诉请求方没有发出去。对方的结果作为 `task.result` 回到这个 Bot，由它的前台回复原请求者。回答别的 Bot 的请求就是那一轮的回复，不用 `ask_bot`。回复正文里的 JSON 字段或 “@名字” 行不会变成请求。对方节点读不到这个节点的文件路径：这条消息带的附件自动随请求发出，其他要交给对方的本地文件写进 `files`（最多 10 个），节点上传后只附在这个请求上。消息的 `hop` 是这件事在 Bot 之间转了几次：每个请求加一，回复和结果沿用请求的值；转到第 4 次后 `ask_bot` 拒绝再转，前台用手上的信息回复请求者，回来的结果仍然送达。一个请求只得到一份结果：同一轮里已经派工或 `task_join` 时 `ask_bot` 被拒绝（工作者的结果会直接交给请求者），已经 `ask_bot` 时派工和 `task_join` 被拒绝；前台等对方结果回来，再把结果和要求一起交给工作者。
- 往来（exchange）记录每次 Bot 间请求：方向、对方、途径（`matrix`）、代表的源消息、状态（received → dispatched → delivered，或 sending → sent → returned，失败为 failed）和任务编号。主人通过 kernel 管理通道的 `contacts` 操作只读查看，按联系人过滤，按时间分页。
