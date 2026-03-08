#!/usr/bin/env node
/**
 * Daily Brief — Setup Wizard
 * Run once to generate your config.json and .env file.
 * You can delete this file after setup.
 */

import readline from 'readline';
import fs from 'fs';
import { execSync } from 'child_process';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const ask = (question) => new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
const askYN = async (question, defaultYes = false) => {
  const answer = await ask(question);
  if (answer === '') return defaultYes;
  return answer.toLowerCase().startsWith('y');
};

function printHeader() {
  console.log('');
  console.log('============================================');
  console.log('  Daily Brief — Setup Wizard');
  console.log('============================================');
  console.log('');
  console.log("Let's get your brief configured. Takes ~2 minutes.");
  console.log('');
}

function printDivider() {
  console.log('');
  console.log('--------------------------------------------');
  console.log('');
}

async function main() {
  printHeader();

  // [1/7] Brief name
  console.log('[1/7] What should your brief be called?');
  console.log('      (e.g. "Crypto Morning Brief", "My Daily Digest", "The AI Filter")');
  const briefName = await ask('> ') || 'My Daily Brief';

  console.log('');

  // [2/7] Niche and audience
  console.log('[2/7] Describe your niche and audience in one sentence.');
  console.log('      Claude uses this to frame the brief and generate content angles.');
  console.log('      (e.g. "AI tools for non-technical professionals" or "crypto trading for retail investors")');
  const audience = await ask('> ') || 'professionals who want to stay informed on this topic';

  console.log('');

  // [3/7] Topics
  console.log('[3/7] What topics/keywords do you want to monitor? (comma-separated)');
  console.log('      (e.g. "ChatGPT, Claude, AI tools, automation")');
  const topicsInput = await ask('> ');
  const topics = topicsInput
    ? topicsInput.split(',').map(t => t.trim()).filter(Boolean)
    : ['your-topic'];

  console.log('');

  // [4/7] Purpose
  console.log('[4/7] What are you using this brief for?');
  console.log('      1) Stay informed — just tell me what\'s happening');
  console.log('      2) Content creation — I also want post/video angles');
  console.log('      3) Both');
  const purposeInput = await ask('> (1/2/3, default: 1) ') || '1';
  const includeContentAngles = purposeInput === '2' || purposeInput === '3';

  console.log('');

  // [5/7] Frequency
  console.log('[5/7] How often do you want to run this? (daily / weekly)');
  const frequency = await ask('> ') || 'daily';

  printDivider();
  console.log('--- PLATFORMS ---');

  console.log('');

  // Reddit
  let redditSubreddits = [];
  console.log('Reddit is FREE (public API, no account needed).');
  const useReddit = await askYN('Monitor Reddit? (y/n) > ');
  if (useReddit) {
    console.log('  Which subreddits? No r/ needed. (comma-separated)');
    console.log('  (e.g. "ChatGPT, LocalLLaMA, entrepreneur")');
    const subsInput = await ask('  > ');
    redditSubreddits = subsInput
      ? subsInput.split(',').map(s => s.trim().replace(/^r\//i, '')).filter(Boolean)
      : [];
  }
  console.log('');

  // Twitter
  let twitterAccounts = [];
  console.log('Twitter/X costs ~$0.02 per run (~$0.60/month if daily) via Apify.');
  const useTwitter = await askYN('Monitor Twitter/X? (y/n) > ');
  if (useTwitter) {
    console.log('  Which accounts? No @ needed. (comma-separated)');
    console.log('  (e.g. "OpenAI, AnthropicAI, gregisenberg")');
    const accountsInput = await ask('  > ');
    twitterAccounts = accountsInput
      ? accountsInput.split(',').map(a => a.trim().replace(/^@/, '')).filter(Boolean)
      : [];
  }
  console.log('');

  // YouTube
  let youtubeChannels = [];
  console.log('YouTube is FREE (RSS feeds + transcripts via yt-dlp).');
  const useYouTube = await askYN('Monitor YouTube? (y/n) > ');
  if (useYouTube) {
    console.log('  Paste channel IDs (comma-separated).');
    console.log('  Find them at: youtube.com/@channelname → right-click → view page source → search "channelId"');
    const channelsInput = await ask('  > ');
    if (channelsInput) {
      youtubeChannels = channelsInput
        .split(',')
        .map(c => c.trim())
        .filter(Boolean)
        .map(id => ({ id, name: id }));
    }
    // Check yt-dlp is installed
    try {
      execSync('which yt-dlp', { stdio: 'pipe' });
    } catch {
      console.log('');
      console.log('  ⚠️  yt-dlp not found. Transcripts won\'t be extracted without it.');
      console.log('  Install it before running:');
      console.log('    macOS:   brew install yt-dlp');
      console.log('    Windows: winget install yt-dlp');
      console.log('    Linux:   sudo pip install yt-dlp');
      console.log('  (YouTube channel list will still be scraped — just no transcripts)');
    }
  }

  printDivider();
  console.log('--- DELIVERY ---');
  console.log('');

  // [6/7] Delivery
  console.log('[6/7] Where should the brief be delivered?');
  const emailAddress = await ask('  Email address (leave blank to skip email delivery): ');
  const saveMarkdown = await askYN('  Save as markdown file? (y/n, default: y) > ', true);

  printDivider();
  console.log('--- API KEYS ---');
  console.log('');

  // [7/7] API keys
  console.log('[7/7] API keys. These go in a .env file (never committed to git).');
  console.log('');

  console.log('[Required] ANTHROPIC_API_KEY — for generating your brief with Claude');
  console.log('           Get one at: console.anthropic.com');
  const anthropicKey = await ask('> ');

  let apifyToken = '';
  if (useTwitter) {
    console.log('');
    console.log('[Required] APIFY_TOKEN — for Twitter/X scraping');
    console.log('           Get one at: console.apify.com (free tier included)');
    apifyToken = await ask('> ');
  }

  let resendKey = '';
  if (emailAddress) {
    console.log('');
    console.log('[Required] RESEND_API_KEY — for email delivery');
    console.log('           Get one at: resend.com (free up to 3,000 emails/month)');
    resendKey = await ask('> ');
  }

  rl.close();

  // Build config.json
  const config = {
    briefName,
    briefDescription: `a daily briefing for ${audience}`,
    audience,
    includeContentAngles,
    topics,
    timeWindow: frequency === 'weekly' ? '7d' : '24h',
    ...(useReddit && {
      reddit: {
        subreddits: redditSubreddits,
        postsPerSubreddit: 15,
      },
    }),
    ...(useTwitter && {
      twitter: {
        accounts: twitterAccounts,
      },
    }),
    ...(useYouTube && {
      youtube: {
        channels: youtubeChannels,
      },
    }),
    delivery: {
      ...(emailAddress && { email: emailAddress }),
      saveMarkdown: saveMarkdown !== false,
      outputDir: './briefs',
    },
  };

  // Build .env
  const envLines = [];
  if (anthropicKey) envLines.push(`ANTHROPIC_API_KEY=${anthropicKey}`);
  if (apifyToken) envLines.push(`APIFY_TOKEN=${apifyToken}`);
  if (resendKey) envLines.push(`RESEND_API_KEY=${resendKey}`);

  // Write files
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
  fs.writeFileSync('./.env', envLines.join('\n') + '\n');

  // Warn if no output configured
  if (!emailAddress && !saveMarkdown) {
    console.log('');
    console.log('⚠️  Heads up: you\'ve disabled both markdown saving and email delivery.');
    console.log('    Your brief will be generated but not saved anywhere.');
    console.log('    You can change this anytime in config.json.');
  }

  // Cost estimate
  const monthlyDays = frequency === 'weekly' ? 4 : 30;
  const twitterCost = useTwitter ? (0.02 * monthlyDays).toFixed(2) : null;
  const claudeCost = (0.001 * monthlyDays).toFixed(2);

  console.log('');
  console.log('============================================');
  console.log('  Setup complete!');
  console.log('============================================');
  console.log('');
  console.log('Your config.json and .env have been saved.');
  console.log('');
  console.log('Monthly cost estimate:');
  if (useReddit) console.log('  Reddit:    FREE');
  if (useYouTube) console.log('  YouTube:   FREE');
  if (useTwitter) console.log(`  Twitter:   ~$${twitterCost}/month (${frequency} runs)`);
  console.log(`  Claude:    ~$${claudeCost}/month (${frequency} runs)`);
  if (emailAddress) console.log('  Email:     FREE (Resend free tier)');
  console.log('  ─────────────────────────────────────');
  const total = (parseFloat(twitterCost || 0) + parseFloat(claudeCost)).toFixed(2);
  console.log(`  Total:     ~$${total}/month`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Test it now:  node --env-file=.env src/index.js');
  console.log('  2. Automate it:  Push to GitHub → add secrets → enable Actions (see README)');
  console.log('  3. Clean up:     You can delete setup.js once you\'re happy with your config');
  console.log('');
}

main().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
