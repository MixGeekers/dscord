# DSCord 0.4.0-alpha.1 内核与宿主契约

`dscord-kernel` 是 DSCord 管理的 Bot 运行时，基于随包 DS-Bot 0.3.1 源码并包含 DSCord 修改。上游来源、完整性和许可保存在 [UPSTREAM.json](../vendor/ds-bot/UPSTREAM.json)、LICENSE 和 NOTICE；升级随 DSCord 发行进行，上游自身的更新器不替换本内核。

## 支持的宿主

固定 SDK 基线为官方 `@deepseek-ai/dsh@0.2.2-rc.1`。版本常量来自 [runtime-config.mjs](../scripts/runtime-config.mjs)，内核声明来自 [kernel-runtime.mjs](kernel-runtime.mjs) 的 `hostCompatibility`。Node 范围 `>=24.19.0 <25` 来自 [package.json](../package.json)。这是当前支持契约，不是对所有更新或更旧版本的兼容承诺。

内核使用原生 `sessionController.resolveAgent/create`、Session inbox、`sessions.flush`、`tools`、`systemPrompt`、`sessionTitle`、`workspaceRegistry` 和已认证的 shared connection 服务；附件通过宿主的 `attachments.admitPromptContent` 接纳。SDK 的消息、工具 schema 与生命周期接口必须可用，缺少时不能用伪造 Session 或兼容层冒充接入成功。

所需第三方运行库由 [runtime-dependencies.json](../dsh-plugin/runtime-dependencies.json) 和锁文件定义。启动器将 SDK 解析到实际宿主，将随包内核的其他运行库解析到私有依赖目录。模型和工具目录仍由宿主提供。

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

连接到 DSCord 的每个 Bot 分成三部分。前台是 Bot 原有的原生 Session，只保留沟通、回忆和派活工具（`dispatch_work`、`task_status`、`task_cancel`、`task_note`），其他工具在前台被拒绝。程序核心是 `dsh-connect/work-core.mjs`，不调用模型：维护任务台账、并发槽位（默认 3 个）、超时（默认 60 分钟）、取消、补充说明和交付文件核对。工作者是每个任务新建的一个 Session 和目录（节点数据目录下 `workers/<任务 ID>/`），有完整工具，只能用 `work_report` 汇报、用 `work_ask` 提问。

前台规则对 Bot 原生 Session 的每一轮都生效，包括其他 Bot 用 `message_bot` 发来的请求；连接建立时即生效，不等第一条房间消息。

工作者汇报完成时，核心核对列出的文件或 `outputs/` 下的文件（同名同 SHA-256 的只交付一次），然后不经前台，直接把结果回复到原消息并附上文件：完成时是工作者的 `summary`，失败时说明没有完成，宿主重启后结果不确定时只说明不确定、不自动重做。这样结果不排在对话后面，也不会被前台改写或重做。已交付的结果记在台账的 `frontNotes` 里，前台下一轮在 `workResults` 中看到一次。工作者的提问（`work_ask`）仍交给前台，由前台问对方或用 `task_note` 转达。工作者一轮结束却没有汇报，会被提醒一次，再不汇报就记为失败。任务状态的每次迁移记录在任务的 `events` 里，当前工作者和队列出现在节点 kernel 状态的 `work.workers` 与 `work.queue`。宿主重启时未结束的任务记为 `unknown`。

同一个人在同一房间连续发来的消息由节点合并给前台：前台还没开始回答时，排在后面的几条一起交给前台，前台在 `currentMessage.mergedMessages` 里看到前几条，自己判断是一句话拆成几条还是几件事。判断模型（与自然发言共用）决定何时开口：`WAIT` 表示对方还没说完，再等最多 6 秒；`REPLY` 表示现在回答；前台回答途中又来一条时，`JOIN` 表示它和正在回答的是一回事，节点停下这次回答，把几条合起来重新回答，`REPLY` 则等这次答完再单独答。只读工具之外已经动手（例如派了工）的回答不会被打断。没有配置判断模型时，节点等对方最后一条消息过去 2 秒再回答，回答途中的追加消息按 `JOIN` 处理。

Core 的 owner 管理接口通过节点通道访问本内核；网页不接收节点模型凭据。[人物和来源视图](../memory/当前上下文与回顾.md)

## 单实例和原目录采用

默认 Bot home 为实际 DSH home 下的 `bot/`。同一 home 只有一个持有目录租约的运行内核；检测到旧 `/api/bot` 服务或已持有的锁时返回 `DSCORD_KERNEL_CONFLICT`。先停止旧 `ds-bot` 插件或占用进程，再重载 DSCord，不同时运行两个写入者。

首次采用保存 `migrations/dscord-0.4.0/` 快照和 `dscord-kernel.json`。原 state、inflight、Bot ID、Session、记忆目录原位保留，不合并另一个 home 的历史。未知或损坏的数据版本阻止启动。

采用时的不明旧工作保留在 `migrationHeld`，不自动重投；先检查 `migration-work`，再按需要明确恢复。`unknown` 仍是结果不确定，不是完成或未执行的证明。停止宿主会等待工作与记忆后台收尾后释放租约。

## 接入边界

DSCord 的聊天入口是 Matrix。吸收的其他 IM adapter 源码不等于提供了相应的产品配置入口或服务支持。工具、任务、连接器和本地 CLI 能力仍受宿主实际安装、权限与用户设置约束。

健康接口、源码/SDK 契约检查不证明模型能正确聊天、回忆或完成文件任务。模型能力、外部连接器与部署网络须按实际配置使用。[安装与运行](../deploy/kernel-runtime.md)
