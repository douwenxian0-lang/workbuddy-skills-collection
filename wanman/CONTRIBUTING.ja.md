# Contributing to wanman

[English](CONTRIBUTING.md) | [中文](CONTRIBUTING.zh.md) | **日本語**

wanman への貢献ありがとうございます。このリポジトリは Node 20+ を対象とした pnpm + Turborepo TypeScript monorepo です。

## 前提条件

- Node.js 20 以上。
- pnpm 9 以上（`corepack enable && corepack prepare pnpm@9.15.0 --activate`）。
- Git。

## ワークスペースコマンド

```bash
pnpm install      # ワークスペースの全依存関係をインストール
pnpm build        # 各パッケージを turbo-build（dist/）
pnpm typecheck    # ワークスペース全体に tsc --noEmit
pnpm test         # ワークスペース全体で vitest run
pnpm clean        # turbo キャッシュと node_modules を削除
```

Turbo はパッケージごとに結果をキャッシュするため、小さな変更後に `pnpm build` や `pnpm test` を再実行するコストは低く抑えられます。

## パッケージ単位の開発

反復開発時は単一パッケージ内で作業します:

```bash
pnpm --filter @wanman/cli test
pnpm --filter @wanman/cli typecheck
pnpm --filter @wanman/cli build

pnpm --filter @wanman/runtime test
pnpm --filter @wanman/core test
pnpm --filter @wanman/host-sdk build
```

Vitest の watch モード:

```bash
pnpm --filter @wanman/runtime exec vitest
```

## 新規コードに必須のテスト

新機能およびバグ修正はテストと併せて提出する必要があります。可能な限り TDD に従ってください:
1. 望ましい挙動を固定する失敗テストを書きます。
2. それをパスさせる最小限の変更を実装します。
3. テストが green の状態でリファクタします。

カバレッジなしで機能をマージしないでください。もし本当にテスト不能な部分がある場合（例: 実在の Claude API キー、サードパーティ TTY などが必要な場合）、PR 説明で明示し、後で有効化できる統合テストのスケルトンを追加してください。

## コードスタイル

- TypeScript 5.7、全面 ESM（`"type": "module"`）。
- インデントは 2 スペース、シングルクォート、セミコロンは周辺コードと整合させます。
- 名前付き export を優先します。default export はエントリポイント的なファイルのみに留めます。
- 関数は小さく意図が読み取れるように保ちます。新しいパターンを発明するのではなく、編集しているパッケージの既存パターンに合わせてください。
- 理由をコメントで説明しない `any` は使わないでください。

push 前に `pnpm typecheck` を実行してください。

## コミットメッセージ規約

コミットメッセージはリポジトリ全体で用いられている軽量な conventional-commits スタイルに従います:

```
<type>(<scope>): <short imperative summary>
```

`<type>` は次のいずれかです:

| Type | 用途 |
|------|---------|
| `feat` | ユーザーから見える新機能。 |
| `fix` | バグ修正。 |
| `refactor` | 挙動変更を伴わない内部構造の整理。 |
| `test` | テストのみの変更。 |
| `docs` | ドキュメント変更。 |
| `chore` | ツール、依存関係、雑務。 |

`<scope>` は対象のパッケージ/領域です: `cli`、`runtime`、`core`、`host-sdk`、`skills`。複数スコープはカンマ区切りです（例: `fix(runtime,cli): ...`）。

例:

```
fix(runtime): make skill-snapshots path configurable
refactor(cli): strip control-plane commands
test(runtime): drop production-agent imports
chore(skills): drop wanman-specific skills, keep generic ones
docs: README, quickstart, architecture, contributing
```

サマリは 72 文字程度以内に収めてください。コンテキスト、動機、リンクは本文で説明します。

## Issue と Pull Request の提出

- Issue と PR は [github.com/chekusu/wanman](https://github.com/chekusu/wanman) で管理されています。
- バグ報告には以下を含めてください: 再現手順、期待する挙動と実際の挙動、wanman のバージョン（commit SHA）、Node バージョン、関連する環境変数（`WANMAN_RUNTIME`、`WANMAN_URL`）。
- PR では動機を説明し、変更したファイルを列挙し、該当 issue があればリンクしてください。

## ライセンス

貢献いただいた内容は、このリポジトリの [LICENSE](LICENSE) と同じ Apache-2.0 でライセンスされることに同意したものとみなされます。
