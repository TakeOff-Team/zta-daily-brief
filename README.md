# Daily Brief

Get a personalized daily briefing on any topic — delivered to your inbox or saved as a markdown file. Scrapes Reddit, Twitter/X, and YouTube, then uses Claude to synthesize the signal into a readable brief.

Works for any niche. Setup takes under 5 minutes.

---

## What It Does

Every day (or on a schedule you set), Daily Brief:
1. Collects posts from the subreddits, Twitter/X accounts, and YouTube channels you choose
2. Sends everything to Claude, which distills it into a structured brief
3. Delivers the brief to your email and/or saves it as a markdown file

The brief always includes: a top story, what people are actually saying, notable updates, and content angles for your niche.

---

## Use Cases

- **Daily news brief** — stay current on your industry without reading 50 feeds
- **Content research** — know what your audience is talking about before you post
- **Market monitoring** — track trends in crypto, health tech, finance, or any vertical
- **Competitor tracking** — follow the accounts that matter in your space
- **Investor deal flow** — surface emerging companies and discussions before they go mainstream
- **Trend spotting** — catch what's gaining traction on Reddit before it hits mainstream media

---

## Cost

| Platform | Cost | Notes |
|----------|------|-------|
| Reddit | FREE | Public API, no account needed |
| YouTube | FREE | RSS feeds + yt-dlp transcripts |
| Twitter/X | ~$0.60/month | Via Apify, ~$0.02 per daily run |
| Claude | ~$0.03/month | Claude Haiku for summarization |
| Email | FREE | Resend free tier (3,000 emails/month) |
| **Total (with Twitter)** | **~$0.63/month** | |
| **Total (without Twitter)** | **$0.00** | Fully free stack |

---

## Quick Start

```bash
git clone <this-repo>
cd daily-brief
npm install
node setup.js
```

The setup wizard interviews you (~2 minutes) and generates your `config.json` and `.env`. Then run it:

```bash
node --env-file=.env src/index.js
```

Your brief will be saved to `./briefs/` and emailed if you configured delivery.

---

## Automating with GitHub Actions

The included workflow runs your brief automatically every day at 8am UTC.

**Steps:**

1. Push this folder to a GitHub repo
2. Go to **Settings → Secrets and variables → Actions** and add:
   - `DAILY_BRIEF_CONFIG` — paste the full contents of your `config.json`
   - `ANTHROPIC_API_KEY` — your Anthropic API key
   - `APIFY_TOKEN` — only if you enabled Twitter/X
   - `RESEND_API_KEY` — only if you enabled email delivery
3. Go to **Actions → Daily Brief → Enable workflow**

The brief will run daily and upload as a GitHub artifact (retained 30 days). If you added an email address to your config, it'll also land in your inbox.

**Manual trigger:** Go to Actions → Daily Brief → Run workflow. You can override the time window there (e.g. `48h` to backfill).

---

## Advanced Config

You can edit `config.json` directly after setup. Key fields:

```json
{
  "briefName": "My Daily Brief",
  "briefDescription": "a daily briefing for crypto traders who want signal without noise",
  "audience": "retail crypto investors who want to know what's moving before it moves",
  "topics": ["Bitcoin", "Ethereum", "DeFi", "crypto regulations"],
  "timeWindow": "24h",
  "reddit": {
    "subreddits": ["CryptoCurrency", "Bitcoin", "ethfinance"],
    "postsPerSubreddit": 15
  },
  "twitter": {
    "accounts": ["APompliano", "VitalikButerin", "CoinDesk"]
  },
  "youtube": {
    "channels": [
      {"id": "UCRvqjQPSeaWn-uEx-w0XOIg", "name": "Bankless"}
    ]
  },
  "delivery": {
    "email": "you@example.com",
    "saveMarkdown": true,
    "outputDir": "./briefs"
  }
}
```

**Time window override** — use `--window` flag to change the lookback period for a single run:
```bash
node --env-file=.env src/index.js --window=48h
```

**Analyze cached data** — re-run the Claude summarization without re-scraping (saves API costs):
```bash
node --env-file=.env src/index.js --analyze-only
```

---

## Finding YouTube Channel IDs

Go to `youtube.com/@channelname`, right-click → View Page Source, then search for `"channelId"`. Copy the value that looks like `UCxxxxxxxxxxxxxxxxxxxxxxx`.

---

## FAQ

**Can I run this without Twitter?**
Yes. Just say no when the setup wizard asks, or remove the `twitter` key from `config.json`. The brief uses Reddit and YouTube only — and it's completely free.

**What if I don't want email delivery?**
Leave the email field blank in setup. Your briefs will save to `./briefs/` as markdown files instead.

**How do I change my niche after setup?**
Edit `config.json` directly. Change `briefName`, `briefDescription`, `audience`, `topics`, and your platform lists. No code changes needed.

**How do I add more platforms?**
Scrapers live in `src/scrapers/`. Each is a standalone module that exports a single async function. Add a new scraper file, wire it into `src/index.js`, and pass the results to `generateBrief()` in `src/summarizer.js`.

**What model does it use?**
Claude Haiku by default — fast and cheap. If you want deeper analysis, change `claude-haiku-4-5-20251001` in `src/summarizer.js` to `claude-sonnet-4-6` or another model.

**Is my API key safe?**
Your `.env` is gitignored and never committed. When running via GitHub Actions, keys are stored as repository secrets — encrypted and never visible in logs.

---

## Project Structure

```
daily-brief/
├── setup.js                    # One-time setup wizard
├── src/
│   ├── index.js                # Main orchestrator
│   ├── formatter.js            # Markdown brief formatter
│   ├── summarizer.js           # Claude integration
│   ├── scrapers/
│   │   ├── reddit.js           # Reddit public API
│   │   ├── twitter.js          # Twitter/X via Apify
│   │   └── youtube.js          # YouTube RSS + yt-dlp transcripts
│   └── delivery/
│       ├── email.js            # Email via Resend
│       └── file.js             # Markdown file output
├── config.example.json         # Config template
├── .env.example                # API keys template
├── .github/workflows/
│   └── daily-brief.yml        # GitHub Actions automation
└── README.md
```
