# dsh-ops-kit

这是一个可复用的 DeepSeek Harness bundle，用于证据驱动的 memory、编排、benchmark 运维、仓库审计和插件发布。它不是一个很小的 prompt，而是一组可安装、可验证、可扩展的 skill 和只读工具。

## 它增强什么

- **Git-first memory**：从有来源的 Markdown 记忆、索引和校验结果中检索，区分事实、推断、矛盾和缺口。
- **RLVR 编排**：把研究/评测拆成目标、基线、执行、覆盖审查和交付，要求每一步都有证据。
- **OctoLoop 编排**：保留 leader 唯一远程派工、成员共享工作树、runtime 归属和清理台账这些关键约束。
- **Benchmark evidence**：统一 run manifest、precheck、日志、结果、清理报告和敏感信息审计。
- **插件发布**：从源码到可安装 DSH bundle，覆盖脱敏、构建、安装、真实重连探针、版本发布和回滚。

## 提供的工具

| 工具 | 能做什么 | 副作用 |
| --- | --- | --- |
| `dsh_ops_capability_catalog` | 查看能力目录 | 无 |
| `dsh_ops_workflow_plan` | 生成 memory、研究、协作、benchmark 或发布计划 | 无 |
| `dsh_ops_skill_read` | 读取随包提供的完整 skill | 无 |
| `dsh_ops_memory_search` | 在限定本地根目录搜索文本 | 只读 |
| `dsh_ops_repository_audit` | 审计 Git 状态和发布阻塞项 | 只读 |
| `dsh_ops_release_checklist` | 生成完整发布清单 | 无 |

## 安装

```bash
pnpm add https://github.com/LeslieWylie/dsh-ops-kit.git
```

把 `@dsh-community/dsh-ops-kit` 加到 profile 的 `dependencies` 和 `dsh.profile.bundles`。它是独立的通用集成层，不冒充官方实现。

本地开发验证：

```bash
pnpm install --offline --ignore-scripts
pnpm build
pnpm typecheck
pnpm test
```

接入运行中的 DSH 后，还要验证 HTTP 200、重启后 profile 仍为 running、skill 能列出，以及 `dsh_ops_capability_catalog` 返回能力目录。

## 安全边界

插件默认只读，不自动创建 Octo Issue、不调用远程 API、不启动 benchmark、不改仓库、不读取 token。`roots` 应配置为最小目录；插件会跳过 `.git`、`secrets`、`runs`、`tmp`、`node_modules` 等目录，并拒绝 credential-like 路径。

## 来源

这是一个独立的新集成层，把 Git-backed memory、证据编排、benchmark hygiene 和安全发布等通用工程实践重新组织为 DSH bundle。内部源仓库不会被复制或公开；没有打包凭据、运行产物、原始私有数据或机器特定 secrets。

MIT License。
