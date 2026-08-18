# dsh-ops-kit

[English](README.md) | [中文](#)

**五个只读 skill，让 agent 在开口之前先亮出证据——无论它说的是"我记得这个"、"计划做完了"、"benchmark 过了"，还是"可以发布了"。**

另外提供运行时体检，专门检查官方 PTY prompt 握手；否则极简模式下 terminal 和 persistent-bash 使用不同完成暗号时，命令会表现得像卡死。

## 为什么做这个

Agent 说错话的时候往往一样自信。这个 bundle 只坚持一条规则：agent 声称"我记得这个"、"计划已就绪"、"benchmark 通过了"、"可以安全发布"之前，应该能指出可核查的证据，而不只是一句断言。五个聚焦的 skill 包共享这一套纪律——限定范围的 memory 检索、证据驱动的编排规划、多 agent 协作的调度规则、benchmark 结果把关、插件发布卫生——而不是把同一个想法拆成五个各自独立安装、各自占一个插件索引位置的包。

默认情况下一切都很保守：不会静默创建 Issue、不调用远程 API、不启动 benchmark、不修改仓库、不读取凭据。这个 bundle 给 agent 的是计划、检查项和证据词汇；任何有副作用的动作，都留在 bundle 之外，作为显式的、可复核的操作。

## 安装

```bash
dsh plugin --profile <profile> add dsh-ops-kit
```

从 registry 安装不需要本地构建，也不需要 `allowBuilds` 授权。如果你更习惯手改 profile 清单，等价写法是：

```jsonc
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": {
    "dsh-ops-kit": "^0.1.0"
  },
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-ops-kit"]
    }
  }
}
```

然后为该 profile 重新安装依赖并重启。

## 提供的能力

| 能力包 | 工具 | 能做什么 | 副作用 |
| --- | --- | --- | --- |
| 能力目录 | `dsh_ops_capability_catalog` | 列出包含的能力包 | 无 |
| 证据驱动编排 | `dsh_ops_workflow_plan` | 为研究、多 agent 协作、benchmark 或发布场景生成"目标 → 基线 → 上下文控制 → 执行 → 验证 → 交付"计划 | 无 |
| Skill 参考 | `dsh_ops_skill_read` | 读取随包提供的完整 skill 定义 | 无 |
| Git-first memory | `dsh_ops_memory_search` | 在限定的本地 Markdown/代码根目录中检索，带来源出处 | 只读 |
| 仓库审计 | `dsh_ops_repository_audit` | 审计 Git 状态、未跟踪文件和凭据路径卫生 | 只读 |
| 发布卫生 | `dsh_ops_release_checklist` | 生成完整的 DSH 插件发布清单 | 无 |
| 发布核验 | `dsh_ops_plugin_doctor` | 不是复述清单，而是拿它去量一个插件仓库：`dsh.bundle` + `cordis.patch.yml` 可安装性、patch 行与包名是否对得上、`private`/`files`/`exports` 的可发布性、`@deepseek-ai/*` 是否留在 peer、以及打印 `SKIPPED` 后 `exit 0` 的假绿 boot 套件 | 只读 |
| 运行时体检 | `dsh_ops_runtime_doctor` | 检查官方 terminal/persistent-bash 握手是否一致 | 只读 |

`dsh_ops_release_checklist` 说发布需要满足什么，`dsh_ops_plugin_doctor` 负责测量它有没有真的做到。这个拆分是刻意的——没人核验的清单，正是 boot 套件打印 `SKIPPED` 然后 `exit 0`、CI 一片绿而集成检查从未跑过的由来，也是某个插件一直挂着 `"private": true`、根本发不出去的由来。

多 agent 协作的调度规则（leader 唯一派工、共享工作树协调、runtime 归属、清理证据）和 benchmark 证据把关（manifest、precheck、产物清单、结果完整性检查）内置在 workflow-plan 和 release-checklist 这两个 skill 里，而不是单独的工具。

`dsh_ops_memory_search` 是在下面配置的目录范围内做一次有界、无状态的检索：不建索引、不落盘，只回报命中的文件和行号。用来回答"这个 profile 之前见过这件事吗"深度刚好，用来承载"改完文件之后还得算数"的记忆则不够。当答案需要一个钉在某个 commit 上的引用、并且需要在引用失效时被告知，用 [`repository-memory`](https://github.com/LeslieWylie/repository-memory)：它是独立的 MCP server，并不绑定 DSH。两者互补而非二选一；本包里的 `memory-evidence` skill 描述的是用它们时都该守的纪律。

## 配置本地根目录

使用 `dsh_ops_memory_search` 或 `dsh_ops_repository_audit` 时，把 `roots` 配置为该 profile 允许检查的目录。根目录要窄，绝不要指向凭据目录。

```yaml
# 示例 overlay；请按实际 profile 配置格式调整
- id: dsh-ops-kit
  config:
    roots:
      - /workspace/project
      - /workspace/memory
    maxFiles: 120
    maxBytesPerFile: 160000
```

如果没有配置 `roots`，工具默认使用 DSH 进程的当前工作目录。类凭据路径和常见的运行/密钥目录会被拒绝或跳过。

## 设计来源

这是一个独立的新集成层，从通用工程实践中提炼而来，并非任何内部源仓库的拷贝。这里不会打包凭据、运行产物、原始私有数据或机器特定配置。

## 验证

```bash
pnpm install --offline --ignore-scripts
pnpm build
pnpm typecheck
pnpm test
```

包内还提供受保护的 `dsh-terminal-hotfix`。它只在匹配官方 rc.6 已知编译布局时修改，并自动生成带时间戳备份，随后重新检查 prompt 握手：

```bash
dsh-terminal-hotfix --check
dsh-terminal-hotfix --apply
```

执行后需要重启 DSH。它不会由插件加载器偷偷执行，也不会静默修改依赖。

接入运行中的 profile 后，还需验证：DSH 端点返回 HTTP 200、重启后 profile 仍处于 running、打包的 skill 能被列出、`dsh_ops_capability_catalog` 返回全部能力包，以及 `dsh_ops_runtime_doctor` 为 healthy。若报告 `terminal-prompt-mismatch`，先用 `dsh-terminal-hotfix --check` 检查，再执行可回滚修复；doctor 本身不会修改 `node_modules`。

## 许可

贡献前请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [SECURITY.md](SECURITY.md)。

MIT License。
