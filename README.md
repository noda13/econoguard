# Econoguard - グローバル経済リスクモニター

グローバルな経済リスクをリアルタイムで収集・分析・可視化するダッシュボードアプリ。RSSフィードと経済指標データを自動収集し、Gemini AIで日本語要約とリスク評価を行う。完全無料で運用可能。

**本番URL**: https://noda13.github.io/econoguard/

---

## 主な機能

- **ニュース自動収集** — NHK・Bloomberg・CNBC・日経・FT・MarketWatch・BOJ・Google News のRSSフィードを毎時取得
- **経済指標モニタリング** — BTC・ETH・Gold・USD/JPY をCoinGecko APIで取得
- **AI分析** — Gemini 2.0 Flash（無料枠）でニュースを日本語要約、4カテゴリのリスクスコアを算出
- **ダッシュボード表示** — リスク指数チャート、指標一覧、カテゴリ別リスク、ニュースフィードを一画面に表示

---

## リスクカテゴリ

| カテゴリ | Slug | 監視対象 |
|---|---|---|
| 通貨・金融 | `currency_finance` | 為替、金利、インフレ、銀行、CBDC |
| 地政学・供給網 | `geopolitics_supply_chain` | 貿易摩擦、制裁、エネルギー、食料安全保障 |
| テクノロジー | `technology` | AI規制、サイバー攻撃、半導体 |
| 社会・政策 | `social_policy` | 中央銀行政策、財政政策、人口動態 |

---

## デプロイモード

### 1. GitHub Pages（本番・推奨）

GitHub Actions で毎時データ収集 → `gh-pages` ブランチに静的ファイルをデプロイ。インフラコスト $0。

### 2. Docker Compose（ローカル開発）

Express + Prisma + SQLite によるバックエンドを含む完全なローカル環境。

---

## Tech Stack

| レイヤー | 技術 |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, Recharts, TanStack Query |
| Backend (local) | Express, Prisma, SQLite |
| LLM | Gemini 2.0 Flash (free tier) / Ollama (local, optional) |
| Data Sources | RSS feeds + CoinGecko API |
| CI/CD | GitHub Actions (hourly cron) + GitHub Pages |

---

## セットアップ

### GitHub Pages（本番）

1. リポジトリをクローン
2. **GitHub Settings > Secrets and variables > Actions** で `GEMINI_API_KEY` を設定
3. **GitHub Settings > Pages > Source** を `GitHub Actions` に設定
4. Actions タブから `Collect Economic Data` を手動実行してデータを初期生成
5. https://noda13.github.io/econoguard/ にアクセスして確認

### ローカル開発（Docker）

```bash
cp .env.example .env
# .env を編集して API キーを設定

docker compose up -d
# http://localhost:3000 でアクセス
```

### ローカル開発（pnpm）

```bash
pnpm install

# Backend
cd backend
cp ../.env.example .env
npx prisma migrate dev
npx tsx prisma/seed.ts
pnpm dev

# Frontend（別ターミナル）
cd frontend
pnpm dev
```

---

## 環境変数

| 変数名 | 必須 | 説明 |
|---|---|---|
| `GEMINI_API_KEY` | Yes（LLM使用時） | Google AI Studio の APIキー |
| `OLLAMA_BASE_URL` | No | ローカルLLM（Ollama）のURL |
| `FRED_API_KEY` | No | FRED経済データAPI |
| `NEWSAPI_KEY` | No | NewsAPI（追加ニュースソース） |

`.env.example` を参照してコピーして使用する。

---

## ディレクトリ構成

```
econoguard/
├── frontend/               # React ダッシュボード
├── backend/                # Express API（ローカル開発用）
├── scripts/                # 静的データ収集スクリプト（GitHub Actions用）
├── .github/
│   └── workflows/
│       ├── collect.yml     # 毎時データ収集
│       └── deploy.yml      # GitHub Pages デプロイ
└── docker-compose.yml      # ローカル開発環境
```

---

## RSSソース設定

RSSフィードの設定は2箇所に存在する（デプロイモードによって異なる）。

| ファイル | 用途 |
|---|---|
| `scripts/collect-static.ts` | GitHub Actions（本番） |
| `backend/src/services/newsCollector.ts` | Docker／pnpm（ローカル開発） |

**現在の収集ソース**: NHK ビジネス, BOJ, 日経, CNBC, Bloomberg, MarketWatch, FT, Google News（ビジネス／国際）

---

## データ収集

- **頻度**: 6時間ごと（GitHub Actions cron: `0 */6 * * *`）
- **フロー**: RSS取得 → Gemini APIでリスク評価・要約 → JSONとして `public/data/` に保存 → GitHub Pages へデプロイ

---

## コスト

**$0 / 月**

- Gemini 2.0 Flash: 無料枠内で運用
- GitHub Actions: 無料枠（2,000分/月 — 6時間毎で約240分/月消費）
- GitHub Pages: 無料
