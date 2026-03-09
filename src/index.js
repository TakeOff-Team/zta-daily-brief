import fs from 'fs';
import path from 'path';
import { scrapeReddit } from './scrapers/reddit.js';
import { scrapeTwitter } from './scrapers/twitter.js';
import { scrapeYouTube } from './scrapers/youtube.js';
import { generateBrief } from './summarizer.js';
import { formatBrief } from './formatter.js';
import { saveMarkdown } from './delivery/file.js';
import { sendEmail } from './delivery/email.js';

const CACHE_PATH = './cache/latest.json';
const SLOW_SCRAPER_WARN_MS = 120_000;

function parseWindow(windowStr) {
  const match = windowStr.match(/^(\d+)(h|d)$/);
  if (!match) throw new Error(`Invalid time window "${windowStr}". Use formats like "24h" or "7d".`);
  const value = parseInt(match[1]);
  const unit = match[2];
  return unit === 'd' ? value * 24 : value;
}

function saveCache(data) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2));
  console.log(`  Cache saved to ${CACHE_PATH}`);
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) {
    console.error(`No cache file found at ${CACHE_PATH}. Run npm run scrape first to populate the cache.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
}

async function runWithTiming(name, fn) {
  const t0 = Date.now();
  const result = await fn();
  const elapsed = Date.now() - t0;
  console.log(`  ${name} done in ${elapsed}ms`);
  if (elapsed > SLOW_SCRAPER_WARN_MS) {
    console.warn(`⚠️  [${name}] took longer than expected — check for runaway costs`);
  }
  return result;
}

async function main() {
  const analyzeOnly = process.argv.includes('--analyze-only');

  // Check for required API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set. Run "node setup.js" or add it to your .env file.');
    process.exit(1);
  }

  // Load config
  const configPath = './config.json';
  if (!fs.existsSync(configPath)) {
    console.error('config.json not found. Copy config.example.json to config.json and fill it in.');
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  // Resolve time window: CLI arg overrides config, config overrides default (24h)
  const cliWindowArg = process.argv.find(a => a.startsWith('--window'));
  const cliWindow = cliWindowArg ? cliWindowArg.split('=')[1] || process.argv[process.argv.indexOf(cliWindowArg) + 1] : null;
  const windowStr = cliWindow || config.timeWindow || '24h';
  const windowHours = parseWindow(windowStr);
  config._windowHours = windowHours;

  let redditPosts = [];
  let tweets = [];
  let youtubeVideos = [];

  if (analyzeOnly) {
    console.log('--analyze-only mode: loading cached data...');
    const cache = loadCache();
    console.log(`Using cached data from ${cache.timestamp}`);
    redditPosts = cache.redditPosts || [];
    tweets = cache.tweets || [];
    youtubeVideos = cache.youtubeVideos || [];
  } else {
    console.log(`Collecting content for: ${config.briefName || 'Daily Brief'} (last ${windowStr})`);

    if (config.reddit?.subreddits?.length) {
      console.log('Scraping Reddit...');
      try {
        redditPosts = await runWithTiming('Reddit', () => scrapeReddit(config));
        console.log(`  Got ${redditPosts.length} Reddit posts`);
      } catch (err) {
        console.error('Reddit scrape failed:', err.message);
      }
    }

    if (config.twitter?.accounts?.length) {
      console.log('Scraping Twitter...');
      console.log('  ⚠️  Twitter (Apify) — this call costs ~$0.02 in credits');
      try {
        tweets = await runWithTiming('Twitter', () => scrapeTwitter(config));
        console.log(`  Got ${tweets.length} tweets`);
      } catch (err) {
        console.error('Twitter scrape failed:', err.message);
      }
    }

    if (config.youtube?.channels?.length) {
      console.log('Checking YouTube channels...');
      try {
        youtubeVideos = await runWithTiming('YouTube', () => scrapeYouTube(config));
        console.log(`  Got ${youtubeVideos.length} new video(s)`);
      } catch (err) {
        console.error('YouTube scrape failed:', err.message);
      }
    }

    // Save cache after scraping
    saveCache({ timestamp: new Date().toISOString(), redditPosts, tweets, youtubeVideos });
  }

  if (!redditPosts.length && !tweets.length && !youtubeVideos.length) {
    console.error('No data collected from any source. Check your config and API tokens.');
    process.exit(1);
  }

  // Summarize with Claude
  console.log('Generating AI brief...');
  const aiSummary = await generateBrief(redditPosts, tweets, youtubeVideos, config);

  // Format
  const { brief, date } = formatBrief(redditPosts, tweets, youtubeVideos, aiSummary, config);

  // Deliver
  if (config.delivery?.saveMarkdown !== false) {
    saveMarkdown(brief, config);
  }

  if (config.delivery?.email) {
    console.log('Sending email...');
    await sendEmail(brief, config, date);
  }

  console.log('Done.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
