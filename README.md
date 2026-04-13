# Econoguard - グローバル経済リスクモニター

グローバルな経済リスクを自動収集・AI分析・可視化するダッシュボード。RSSフィードと経済指標データを定期収集し、LLMで日本語要約とリスクスコアリングを行う。完全無料で運用可能。

**本番URL**: https://noda13.github.io/econoguard/

---

## 主な機能

- **ニュース自動収集** — NHK・Bloomberg・CNBC・日経・FT・MarketWatch・ZeroHedge・FRB・ECB 等のRSSフィードを定期取得
- **経済指標モニタリング** — BTC・ETH・Gold・USD/JPY をCoinGecko APIで取得
- **AI分析** — LLMでニュースを日本語要約し、4カテゴリのリスクスコアを算出
- **ダッシュボード** — 総合リスク指数、カテゴリ別リスク、推移チャート、経済指標、ニュースフィードを一画面に表示

---

## リスクカテゴリ

| カテゴリ | Slug | 監視対象 |
|---|---|---|
| 通貨・金融 | `currency_finance` | 為替、金利、インフレ、銀行危機、CBDC |
| 地政学・供給網 | `geopolitics_supply_chain` | 貿易摩擦、制裁、エネルギー、食料安全保障 |
| テクノロジー | `technology` | AI規制、サイバー攻撃、半導体供給 |
| 社会・政策 | `social_policy` | 中央銀行政策、財政政策、人口動態 |

---

## Tech Stack

| レイヤー | 技術 |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, Recharts, TanStack Query |
| Backend (local) | Express, Prisma, SQLite |
| LLM | Groq / Gemini / OpenAI / 任意のOpenAI互換API（設定で切替） |
| Data Sources | RSS feeds (11ソース) + CoinGecko API |
| CI/CD | GitHub Actions (6時間ごと cron) + GitHub Pages |

---

## セットアップ

### 1. LLM APIキーの取得（いずれか1つ）

| プロバイダー | 無料枠 | APIキー取得 |
|---|---|---|
| **Groq（推奨）** | 14,400リクエスト/日 | https://console.groq.com/keys でアカウント作成 → 「Create API Key」 |
| Gemini | 1,500リクエスト/日 | https://aistudio.google.com/apikey → 「Create API key in new project」 |
| OpenAI | なし（有料） | https://platform.openai.com/api-keys |
| その他 | 各社による | `LLM_BASE_URL` + `LLM_API_KEY` で任意のOpenAI互換APIを指定可能 |

### 2. GitHub Pages（本番デプロイ）

```bash
# 1. リポジトリをクローン
git clone https://github.com/noda13/econoguard.git

# 2. GitHub Secrets を設定（Settings > Secrets and variables > Actions）
#    以下のいずれかを設定:
#    - GROQ_API_KEY（推奨）
#    - GEMINI_API_KEY
#    - 両方設定した場合、LLM_PROVIDER で優先を指定可能

# 3. GitHub Pages を有効化
#    Settings > Pages > Source: GitHub Actions

# 4. 手動でデータ収集を実行
#    Actions タブ > Collect Economic Data > Run workflow

# 5. サイトにアクセス
#    https://noda13.github.io/econoguard/
```

### 3. ローカル開発（Docker）

```bash
cp .env.example .env
# .env を編集して API キーを設定（GROQ_API_KEY 等）

docker compose up -d
# http://localhost:3000 でアクセス
```

### 4. ローカル開発（pnpm）

```bash
pnpm install

# Backend
cd backend
cp ../.env.example .env   # API キーを設定
npx prisma migrate dev
npx tsx prisma/seed.ts
pnpm dev

# Frontend（別ターミナル）
cd frontend
pnpm dev
```

---

## LLM 設定

### 環境変数によるプロバイダー切替

```bash
# --- 方法1: プロバイダー固有のキーを設定（自動検出） ---
GROQ_API_KEY=gsk_xxxx          # → 自動で Groq (llama-3.3-70b) を使用
GEMINI_API_KEY=AIxxxx           # → 自動で Gemini (gemini-2.0-flash) を使用
OPENAI_API_KEY=sk-xxxx          # → 自動で OpenAI (gpt-4o-mini) を使用

# --- 方法2: 明示的にプロバイダーを指定 ---
LLM_PROVIDER=groq               # 複数キーがある場合に優先プロバイダーを指定

# --- 方法3: 任意のOpenAI互換APIを使用 ---
LLM_API_KEY=your-key
LLM_BASE_URL=https://api.together.xyz/v1
LLM_MODEL=meta-llama/Llama-3.3-70B-Instruct-Turbo
```

### プリセット一覧

| プロバイダー | デフォルトモデル | 自動検出キー |
|---|---|---|
| Groq | `llama-3.3-70b-versatile` | `GROQ_API_KEY` |
| Gemini | `gemini-2.0-flash` | `GEMINI_API_KEY` |
| OpenAI | `gpt-4o-mini` | `OPENAI_API_KEY` |
| Together | `meta-llama/Llama-3.3-70B-Instruct-Turbo` | `LLM_BASE_URL` で指定 |
| OpenRouter | `meta-llama/llama-3.3-70b-instruct` | `LLM_BASE_URL` で指定 |

### GitHub Actions での設定

GitHub Secrets（Settings > Secrets and variables > Actions）に以下を追加:

| Secret名 | 説明 |
|---|---|
| `GROQ_API_KEY` | Groq APIキー（推奨） |
| `GEMINI_API_KEY` | Gemini APIキー（オプション） |
| `LLM_PROVIDER` | 優先プロバイダー（オプション、複数キーがある場合） |

---

## 環境変数一覧

| 変数名 | 必須 | 説明 |
|---|---|---|
| `GROQ_API_KEY` | いずれか1つ | Groq APIキー |
| `GEMINI_API_KEY` | いずれか1つ | Google AI Studio APIキー |
| `LLM_PROVIDER` | No | 優先プロバイダー (`groq`, `gemini`, `openai`) |
| `LLM_BASE_URL` | No | カスタムAPIエンドポイント |
| `LLM_MODEL` | No | カスタムモデル名 |
| `LLM_API_KEY` | No | カスタムAPIキー |
| `FRED_API_KEY` | No | FRED経済データAPI |
| `NEWSAPI_KEY` | No | NewsAPI（追加ニュースソース） |

---

## ニュースソース

### 現在の収集ソース（11件）

| カテゴリ | ソース |
|---|---|
| 日本語 | NHK ビジネス, BOJ, 日経 |
| 海外メディア | Bloomberg, CNBC, MarketWatch, FT, Google News（ビジネス） |
| 中央銀行 | FRB, ECB |
| 金融特化 | ZeroHedge |

### ソース設定ファイル

| ファイル | 用途 |
|---|---|
| `scripts/collect-static.ts` | GitHub Actions（本番） |
| `backend/src/services/newsCollector.ts` | Docker／pnpm（ローカル開発） |

RSSフィードの追加は上記ファイルの `RSS_SOURCES` 配列に `{ url: '...', source: 'name' }` を追加するだけ。

---

## ディレクトリ構成

```
econoguard/
├── frontend/               # React ダッシュボード
│   └── public/data/        # 収集済みJSON（GitHub Actionsで自動更新）
├── backend/                # Express API（ローカル開発用）
├── scripts/
│   └── collect-static.ts   # 静的データ収集スクリプト
├── .github/workflows/
│   ├── collect.yml         # 6時間ごとデータ収集
│   └── deploy.yml          # GitHub Pages デプロイ
└── docker-compose.yml      # ローカル開発環境
```

---

## データ収集フロー

```
[6時間ごと / 手動トリガー]
    ↓
RSS取得（11ソース）+ CoinGecko指標取得
    ↓
LLMでニュース要約（日本語）+ リスクカテゴリ分類
    ↓
LLMで4カテゴリのリスクスコア算出（0-100）
    ↓
JSON保存 → git commit → GitHub Pages自動デプロイ
```

---

## コスト

**$0 / 月**

| リソース | 費用 |
|---|---|
| Groq API | 無料（14,400 req/日） |
| GitHub Actions | 無料枠 2,000分/月（6時間毎で約240分/月消費） |
| GitHub Pages | 無料 |
| CoinGecko API | 無料 |
| RSS | 無料 |
