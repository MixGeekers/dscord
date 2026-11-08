# 真实模型长程剧本

这里的剧本用真实模型、真实 DSH 和真实服务器检验 Bot 的行为，不进 CI，也不被 `npm test` 运行。执行者可以是人，也可以是一个代理（Agent）。

| 剧本 | 检验什么 | 规模 | 时长 |
| --- | --- | --- | --- |
| [01 基础关](01-basic.md) | 单个 Bot 拆成前台、程序核心、工作者以后能不能用 | 1 台服务器、1 个 DSH、2 人、2 Bot、3 个房间 | 约 2 小时 |
| [02 游戏工作室](02-game-studio.md) | 多人、多 Bot、多群、跨服务器的协作 | 2 台服务器、3 个 DSH、6 人、5 Bot、6 个房间 | 约 4 小时 |

先跑 01。01 通过（≥ 80 分且没有一票否决）再跑 02。

## 给执行代理的约定

1. **只扮演人类成员。** 你用人类账号发消息、上传文件、读回复，不登录 Bot 账号，不改 Bot 的提示词、模型或配置，也不在 DSH 里替 Bot 操作。
2. **照抄原话。** 每一步的「发送原话」逐字发送。剧本没写的话不要说；补充、催促或纠正 Bot 都会让该步记 0 分。
3. **答案文件不给 Bot。** `fixtures/*/answer-key.md` 和 `fixtures/game/feedback-labels.csv` 只用来评分，绝不上传到任何房间。
4. **按时间评分。** 前台响应从你发出消息的服务器时间戳（`origin_server_ts`）算到 Bot 第一条回复的时间戳；交付算到带结果的那条回复。
5. **等待上限。** 前台响应超过 60 秒算没响应；单个交付超过 20 分钟算未交付，继续下一步。
6. **出错不重来。** DSH 或服务器崩溃时记下时间、步骤和报错，重启后从下一步继续。

### 用接口代替网页（可选）

网页能做的事都可以直接调 Core 接口，以下路径相对服务器地址：

| 做什么 | 请求 |
| --- | --- |
| 登录 | `POST /api/login`，正文 `{"user":"账号","password":"密码"}`，返回 `access_token` |
| 列出房间 | `GET /api/rooms` |
| 打开与某人的私聊 | `POST /api/dm`，正文 `{"participantId":"@bot:server"}` |
| 上传附件 | `POST /api/attachments?filename=名字`，正文是文件字节，带 `Content-Type`，返回 `attachment.id` |
| 发消息 | `POST /api/rooms/{roomId}/messages`，正文 `{"body":"原话","to":["@bot:server"],"attachments":["附件 id"],"transactionId":"每条唯一"}` |
| 读消息 | `GET /api/rooms/{roomId}/messages?limit=100`，按 `origin_server_ts` 计时 |
| 设置 Bot 的参与方式（所属人） | `PATCH /api/bots/{botId}/attention`，正文 `{"mode":"mention","rooms":{"房间 ID":"natural"}}`；`rooms` 按房间覆盖，省略则保持原来的覆盖 |

所有请求带 `Authorization: Bearer <access_token>`。「@ 某个 Bot」在接口里就是把它放进 `to`。

### 观察 Bot 内部

- DSH 侧栏：每个工作者是一个新 Session，标题是「Bot 名 · 任务标题」。
- 节点目录 `<DSH home>/dscord/<profile>/nodes/<Bot 账号>/`：`workers/T-xxxxxxxx/` 是任务的工作目录；`native-bridge.json` 的 `tasks` 是任务台账，每个任务的 `events` 是状态时间线（`queued`、`running`、`done`、`failed`、`cancelled`、`unknown`）。

## 回报格式

跑完一份剧本，在 PR 上留一条评论，按下面的格式写。每一个没拿满分的步骤都要写出现象和证据，方便直接定位。

```markdown
## 剧本 01 结果：83 / 100，通过

一票否决：无

| 步 | 得分 / 满分 | 前台响应（秒） | 交付（分钟） | 现象 |
| --- | --- | --- | --- | --- |
| S5 | 3 / 6 | 41 | — | S4 运行时私聊回复慢，见 events 时间线 |

### 问题
1. **S5 前台被阻塞 41 秒**：发出 23:10:02，回复 23:10:43；同一时刻 T-1a2b3c4d 处于 running。附 native-bridge.json 片段。
```

附上：每个 Bot 的 `native-bridge.json`、各房间的消息导出（或截图），以及触发一票否决时的原始消息。
