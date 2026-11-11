# 自定义头像

用户可以修改自己的头像，以及自己名下 Bot 的头像。头像属于中央账号资料，使用稳定的中央账号 ID；Bot 不需要在线，修改头像不改变 Bot 的运行配置版本、不重启节点或 Session。

## 使用

- 自己：左下角账号菜单 → 个人设置 → 账号。自己的成员资料卡也提供更换入口。
- Bot：Bot 主页 → 设置，或“我的 Bot”展开对应 Bot 的设置。所属 Bot 的成员资料卡也能修改。
- 选择 JPG、PNG 或静态 WebP，拖动、缩放并预览，点击“保存头像”。手机支持拖动和双指缩放，键盘可操作缩放及水平/垂直位置滑块。
- “恢复默认”恢复名字首字占位。占位颜色由稳定身份决定。
- 上传失败保留原头像与裁剪预览。另一台设备先保存时显示冲突，读取最新版本并保留预览；再次保存表示用户选择覆盖该版本。

头像在账号入口、成员卡、消息、私聊与 Bot 导航、身份组和 `@` 候选中展示。消息展示当前头像，已有聊天正文不重写。Bot 标识与运行状态仍独立展示。中英文、明暗主题使用现有设置。

## 存储与配置

中央的 `central.sqlite` 中增加独立的 `account_profiles` 表，保存头像资源 ID、资料版本和更新时间。标准化后的图片默认位于中央数据目录下的 `avatars/<资源ID>/{64,128,512}.webp`。直接运行默认使用 `.local/central/`，可用已有 `DSCORD_CENTRAL_DATA_DIR` 指定数据目录。Compose 使用现有 `central-data` 卷中的 `/central/avatars/`，无需新增卷。

在中央的 `central-config.json` 中可增加以下字段；省略时采用这些默认值。修改后重启中央服务：

```json
{
  "avatars": {
    "backend": "local",
    "directory": "avatars",
    "maxUploadBytes": 5242880,
    "sizes": [64, 128, 512]
  }
}
```

`directory` 可用绝对路径，或相对于中央数据目录的路径；使用外部目录时自行挂载持久卷。`maxUploadBytes` 范围为 1 至 20971520；反向代理的请求体限制应至少覆盖该值。三个基础尺寸必须保留，可增加 32–1024 之间的尺寸，最多六个。

本期后端为 `local`。现有 `DS_GROUP_S3_*` 配置用于 Synapse 的聊天附件与头像副本，不会改变中央头像的存储位置。中央的 S3 后端尚未实现。

备份中央时，除现有数据库和签名密钥外，同时备份头像目录；备份聊天服务器时继续覆盖其 Core 与 Synapse 数据。标准化的历史头像保留，避免破坏已有链接与 Matrix 历史引用，本期没有自动回收历史版本。原始上传图不持久保存，处理临时目录在请求结束时清除。

中央仅增加身份图片存储；聊天消息和任务附件继续由聊天服务器保存。

## 同步与图片处理

Core 每 5 秒按中央账号 ID 批量核对资料版本。读取到更新后保存到本地账号库，并使用该账号的服务凭据将图片同步至本服 Synapse，设置对应的 Matrix `avatar_url`。图片上传成功但资料写入失败时保留 Matrix 媒体回执，后续重试复用该回执。Core 重启后从持久记录继续同步。中央或 Matrix 暂不可用不阻断聊天 API；恢复后继续补齐。

头像保存后，当前页面及同源标签页立即更新；其他设备和服务器通过版本轮询更新。无网络时不能保存，无法加载图片时显示占位。跨服务器同步是最终一致的，不要求所有服务器同时在线。

头像资料版本独立于 Bot 设置的 `revision`。中央写入采用版本检查，先完成图片持久化再更新引用；失败或旧版本不会改写当前头像。

服务端使用固定依赖 `sharp@0.35.5`，校验真实图片格式、静态帧、40MP 像素上限与裁剪边界，校正 EXIF 方向，重新编码 WebP 并去除原元数据。安装时保留 npm 的 optional dependencies，Linux amd64/arm64 使用对应平台的预编译 sharp/libvips 包；继续支持 `npm ci --ignore-scripts`。

头像图片是公开身份资源，通过无账号令牌的内容版本地址访问，可由浏览器缓存。编辑接口只接受本人或 Bot 所属人的中央会话，聊天服务器管理员身份不授予全局头像编辑权。

## 接口

| 中央接口 | 作用 |
| --- | --- |
| `GET /api/me/avatar` | 读取本人头像、版本及上传上限 |
| `PUT /api/me/avatar?version=N&left=X&top=Y&size=S` | 上传原图字节，按校正方向后的像素裁剪；裁剪参数可全部省略，使用居中裁剪 |
| `DELETE /api/me/avatar?version=N` | 恢复默认 |
| `GET/PUT/DELETE /api/bots/:id/avatar` | 所属人修改对应 Bot，参数同上 |
| `GET /api/profiles?ids=...` | 读取至多 100 个已知中央账号 ID 或全局 ID 的公开头像版本 |
| `GET /avatars/:assetId/:size.webp` | 读取标准化图片 |

写入缺少版本返回 400，版本冲突返回 409；格式不支持返回 415，超限返回 413。客户端调用中央时使用既有 `clientOrigins` 跨域配置。

## 验证

```sh
npm run check
npm run build
node --test --test-concurrency=1 tests/*.browser.mjs
node tests/avatars.runtime.mjs
```

`avatars.test.mjs` 覆盖真实中央 HTTP、图片解码、权限、失败保留、并发更新、持久化和带 Matrix 替身的同步重试。`avatars.browser.mjs` 使用真实中央 HTTP 与 Chromium 验证裁剪、保存、跨标签、冲突、离线 Bot、手机布局及双语。`avatars.runtime.mjs` 显式启动两套隔离 Synapse/Core，验证自动同步、真实 Matrix 媒体、中央/Core 重启及恢复默认；使用合成账号，模型调用为 0。运行日志和截图位于忽略的 `.local/avatar-validation/`，运行脚本会移除本次创建的容器。
