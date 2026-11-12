# 构建与发布 DSCord

本文面向维护者。应用源码根为 `apps/ds-group/`，版本标签交给 GitHub Actions 完成验证、构建及发布。

## 版本与许可证

`package.json` 与 `package-lock.json` 使用同一版本；源码包、容器标签和 npm tarball 直接使用这个版本，打包脚本不会追加 `-alpha.1`。当前阶段为 `0.4.0-alpha.5`：GitHub Release 标记预发布，npm 使用 `alpha` 标签。通用稳定版本使用 `latest`，其他预发布使用其 `alpha` / `beta` / `rc` 渠道或 `next`。发布版本必须是规范 SemVer；统一容器标签不支持 `+build` 后缀。[npm 版本及标签说明](https://docs.npmjs.com/adding-dist-tags-to-packages/)

发布前先确定本体许可，在包根保存 `LICENSE`，并在 `package.json` 的 `license` 写入对应标识。缺少声明或许可文件时，公共发行构建会失败。第三方 DS-Bot 的 Apache-2.0 LICENSE/NOTICE、Ombre 的 MIT LICENSE 及前端依赖声明保持各自归属，不能用本体许可证替换。[npm 许可字段说明](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#license)

## 发行内容

源码包包含应用与部署源码、正常测试及合成夹具、冻结依赖锁、公开使用指南、配置模板和必要许可证。它排除内部实施/验收记录、`deploy/evidence`、运行数据、机器配置、凭据、日志和缓存。规则在 `scripts/release-content.mjs`；新增对外配置或文档时同步更新清单。源码中的测试场景和合成模型设置是测试材料，不是对使用者模型或账号的要求。

npm 包包含预构建前端、服务器和 Bot 运行模块、必要用户/接口指南与许可证；不包含开发测试和实验报告。项目工作区的 `private: true` 保留，用于阻止直接把开发根目录误发到 registry；生成的独立 `dscord` tarball 才是发布对象。[npm private 字段](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#private)

## 本地构建与核对

```sh
npm ci --ignore-scripts
npm run check
npm run build
node scripts/release-pack.mjs
node scripts/release-verify.mjs --require-public-content --extract .local/release-unpacked
node scripts/npm-pack.mjs
```

源码包有逐文件清单和 SHA-256；公共内容策略验证会拒绝误加到清单中的内部报告。npm 产物位于 `.local/npm-release/dscord-版本.tgz`，可用 `tar -tzf` 检查实际内容。不要复用已经发布过的相同 npm 名称和版本；registry 不允许覆盖该组合。[npm publish 规则](https://docs.npmjs.com/cli/v11/commands/npm-publish/)

## PR 检查与完整验证

普通 PR 和 `main` 推送保留一个固定的 `Check and build` 检查。工作流始终启动，在任务内按完整改动列表选择步骤，避免必过检查被路径过滤后一直 Pending。PR 使用 merge base，推送比较前后提交；重命名同时检查新旧路径。手动 CI 运行会选择全部步骤。

| 改动范围 | 验证内容 |
|---|---|
| 普通应用代码和模块测试 | 语法、lint、格式、类型、单测、生产构建 |
| 文档 | 变更文档的本地链接，无需安装 npm 依赖 |
| 网页、管理界面、DSH 客户端及浏览器测试 | 增加 Chromium 测试 |
| Bot 节点、内核、记忆、DSH 接入及原生夹具 | 增加官方 SDK 与真实 DSH 的本地 provider 检查 |
| 服务器、Compose、Docker 和升级脚本 | 增加 Linux amd64 部署、独立中央、备份、升级和回滚检查 |
| CLI、打包和构建脚本、许可证 | 增加干净源码构建及 npm tarball 安装检查 |
| 锁文件、依赖清单、CI 脚本或工作流 | 执行全部上述步骤 |

规则位于 `scripts/ci-scope.mjs`；新增运行输入或调整目录边界时同步维护。所有选中的步骤仍属于同一个任务，任何步骤失败都会让固定检查失败。新提交取消同一 PR 的旧运行。`ds-group-full.yml` 继续提供发行前和手动完整验证，包含 Linux amd64/arm64；两种检查均使用合成账号和本地 provider。

## 自动发布

发行工作流还生成 `server-update.json`，绑定最终多架构镜像摘要，并把它加入 `SHA256SUMS`。更新器只接受清单声明的来源版本与相同节点协议。发布前按[更新说明](updates.md)核对 `deploy/server-update-policy.json`：仅列入已验证升级且数据仍兼容旧程序的来源版本；不适用的发行将 `enabled` 设为 `false`，不生成可安装清单，改走专门迁移流程。独立更新器容器在应用更新期间保留自身版本，随完整部署维护。

`ds-group-v版本` 标签触发 `.github/workflows/ds-group-release.yml`，并要求与包版本和锁一致。完整验证从干净安装的源码发行包构建一次独立 npm tarball，做真实 Synapse/Core 的零模型安装检查，再上传为工作流产物。后续直接使用同一 tarball，不重新打包。双架构容器仍从经过清单验证的源码包构建；容器地址由 `scripts/release-metadata.mjs` 给出。

最终发布任务依次合并并核对镜像 index、生成更新清单与校验和、用 OIDC 发布 npm，并从公共 registry 做干净安装和 CLI 版本检查。GitHub 资产先上传到草稿，逐个回读验证 SHA-256 后再公开。源码、镜像与 registry 是不同系统，失败时不假定它们能一起回滚；以各自回读结果为准。分支 CI、手动完整验证和本地 `pack` 都不执行 registry 发布。

## npm Trusted Publisher 的一次性配置

包的维护者在 [dscord 包设置](https://www.npmjs.com/package/dscord/access) 的 Trusted publishing 中添加 GitHub Actions：

| 字段 | 值 |
|---|---|
| Organization or user | `MixGeekers` |
| Repository | `dscord` |
| Workflow filename | `ds-group-release.yml`，只填文件名 |
| Environment | 留空，当前发布任务未指定 Environment |
| Allowed actions | 启用直接 `npm publish` |

发布任务使用 GitHub 托管 runner，只给最终发布任务 `id-token: write`，并固定 npm CLI `11.19.1`，满足官方 `>=11.5.1` 的 OIDC 要求。无需在 GitHub 保存 npm 发布 token。仓库、工作流文件名和生成包的 `repository.url` 必须一致；改名后同步 npm 的绑定。[npm Trusted Publishing 官方步骤](https://docs.npmjs.com/trusted-publishers/)

## 失败后继续

在原 tag 的 Actions 运行中选择 **Re-run failed jobs**，复用此前成功任务上传的源码、npm tarball 和镜像摘要。产物保留 14 天；不要用移动 tag 或覆写已有版本来修复发布。

- npm 已存在同名同版本时，先比较 SHA-512 integrity；一致则跳过上传，不把 `alpha` / `latest` 移回旧版本；不一致则失败并要求新版本。CLI 上传报错但 registry 已提交时，也以回读的完整性为准。
- 镜像版本标签已存在时，核对双架构镜像及 provenance/SBOM 摘要。一致则复用，不一致则拒绝改写。重新构建的 provenance 可能改变摘要，因此优先重跑原失败任务。
- GitHub 草稿或正式发行已存在时，核对已有资产，只补缺失文件。相同文件名内容不同会失败，不使用 `--clobber`。全部文件回读通过后才将草稿公开。

Actions 的步骤摘要分别记录 npm、镜像摘要和 GitHub 资产结果。OIDC 绑定未完成时，新的 registry 发布会明确失败；不能把本地夹具或工作流语法检查算成真实 npm 发布成功。
