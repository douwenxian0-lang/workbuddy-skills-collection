# 为 wanman 贡献代码

[English](CONTRIBUTING.md) | **中文** | [日本語](CONTRIBUTING.ja.md)

感谢你参与 wanman 的开发。本仓库是一个基于 pnpm + Turborepo 的 TypeScript monorepo，目标运行环境为 Node 20+。

## 前置条件

- Node.js 20 或更新版本。
- pnpm 9 或更新版本（`corepack enable && corepack prepare pnpm@9.15.0 --activate`）。
- Git。

## Workspace 命令

```bash
pnpm install      # install all workspace deps
pnpm build        # turbo-build every package (dist/)
pnpm typecheck    # tsc --noEmit across the workspace
pnpm test         # vitest run across the workspace
pnpm clean        # wipe turbo cache + node_modules
```

Turbo 按 package 缓存结果，因此在小改动之后重新执行 `pnpm build` 或 `pnpm test` 代价很低。

## 单 package 开发

在迭代某个 package 时在其内部操作：

```bash
pnpm --filter @wanman/cli test
pnpm --filter @wanman/cli typecheck
pnpm --filter @wanman/cli build

pnpm --filter @wanman/runtime test
pnpm --filter @wanman/core test
pnpm --filter @wanman/host-sdk build
```

Vitest watch 模式：

```bash
pnpm --filter @wanman/runtime exec vitest
```

## 新代码必须带测试

新特性和缺陷修复都必须附带测试。条件允许时遵循 TDD：
1. 先写一个能固定期望行为的失败测试。
2. 实现让它通过所需的最小改动。
3. 在测试通过状态下做重构。

不要在没有覆盖的情况下合入特性。如果某段行为确实无法测试（例如需要真实的 Claude API key、第三方 TTY 等），请在 PR 描述中明确说明，并补充一个后续可以启用的集成测试骨架。

## 代码风格

- TypeScript 5.7，全面使用 ESM（`"type": "module"`）。
- 2 空格缩进，单引号，分号与周围代码保持一致。
- 优先使用命名导出；默认导出仅保留给 entrypoint 风格的文件。
- 函数保持短小且意图清晰。匹配你正在编辑的 package 中的既有模式，不要另起炉灶。
- 不允许不带注释的 `any`。

推送前运行 `pnpm typecheck`。

## 提交信息约定

提交信息沿用仓库中通行的轻量 conventional-commits 风格：

```
<type>(<scope>): <short imperative summary>
```

其中 `<type>` 是以下之一：

| Type | 用途 |
|------|---------|
| `feat` | 新的用户可见能力。 |
| `fix` | 缺陷修复。 |
| `refactor` | 内部重构，不改变行为。 |
| `test` | 只涉及测试的变更。 |
| `docs` | 文档变更。 |
| `chore` | 工具链、依赖、琐事。 |

`<scope>` 是所触及的 package 或领域：`cli`、`runtime`、`core`、`host-sdk`、`skills`。多个 scope 用逗号分隔，例如 `fix(runtime,cli): ...`。

示例：

```
fix(runtime): make skill-snapshots path configurable
refactor(cli): strip control-plane commands
test(runtime): drop production-agent imports
chore(skills): drop wanman-specific skills, keep generic ones
docs: README, quickstart, architecture, contributing
```

summary 控制在约 72 个字符以内。用正文补充背景、动机和链接。

## 提交 issue 和 pull request

- Issue 和 PR 统一在 [github.com/chekusu/wanman](https://github.com/chekusu/wanman) 跟踪。
- 提交 bug 时请包含：复现步骤、期望与实际行为、wanman 版本（commit SHA）、Node 版本，以及相关环境变量（`WANMAN_RUNTIME`、`WANMAN_URL`）。
- 提交 PR 时请描述动机、列出触及的文件，并在存在对应 issue 时加上链接。

## 许可证

通过贡献代码，你同意你的贡献将按 Apache-2.0 授权，与本仓库的 [LICENSE](LICENSE) 保持一致。
