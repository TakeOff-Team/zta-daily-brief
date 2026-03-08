import { ApifyClient } from 'apify-client';

const ARTICLE_URL_PATTERN = /x\.com\/i\/articles\//;

async function fetchArticleContent(articleUrl) {
  try {
    const res = await fetch(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      console.log(`  [Article] Fetch failed for ${articleUrl}: HTTP ${res.status}`);
      return null;
    }

    const html = await res.text();

    // Try JSON-LD first (most structured)
    const jsonLdMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        const articleText = jsonLd.articleBody || jsonLd.description;
        if (articleText) return articleText.slice(0, 1000);
      } catch {}
    }

    // Fall back to <article> tag content
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      // Strip HTML tags
      const text = articleMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 50) return text.slice(0, 1000);
    }

    // Fall back to meta description
    const metaMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
    if (metaMatch) return metaMatch[1].slice(0, 1000);

    console.log(`  [Article] Could not parse content from ${articleUrl}`);
    return null;
  } catch (err) {
    console.log(`  [Article] Fetch error for ${articleUrl}: ${err.message}`);
    return null;
  }
}

function extractArticleUrl(tweet) {
  // Apify returns expanded URLs in entities.urls[] as {url, expanded_url, display_url}
  const urlEntities = tweet.entities?.urls || tweet.extendedEntities?.urls || [];
  for (const entry of urlEntities) {
    const expanded = entry.expanded_url || entry.expandedUrl || '';
    if (ARTICLE_URL_PATTERN.test(expanded)) return expanded;
  }

  // Some Apify versions surface card metadata
  const cardUrl = tweet.card?.url || tweet.card?.bindingValues?.card_url?.scribeValue?.page || '';
  if (ARTICLE_URL_PATTERN.test(cardUrl)) return cardUrl;

  return null;
}

export async function scrapeTwitter(config) {
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

  const { accounts = [] } = config.twitter;
  const windowHours = config._windowHours || 24;

  if (accounts.length === 0) return [];

  const sinceDate = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

  const input = {
    twitterHandles: accounts.map(a => a.replace('@', '')),
    maxItems: 200,
    sort: 'Latest',
    start: sinceDate,
    includeSearchTerms: false,
  };

  const APIFY_TIMEOUT_MS = 120_000;
  const apifyCall = client.actor('apidojo/tweet-scraper').call(input);
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Apify actor timed out after 120s — check console.apify.com for runaway runs and abort manually if needed')), APIFY_TIMEOUT_MS)
  );
  const run = await Promise.race([apifyCall, timeout]);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  const cutoff = Date.now() - windowHours * 60 * 60 * 1000;

  const filtered = items.filter(tweet => {
    if (!tweet.text) return false;
    const dateStr = tweet.createdAt || tweet.created_at;
    if (dateStr) {
      return new Date(dateStr).getTime() >= cutoff;
    }
    return true;
  });

  const results = [];
  for (const tweet of filtered) {
    const articleUrl = extractArticleUrl(tweet);
    let articleContent = null;

    if (articleUrl) {
      console.log(`  [Article] Found X article from @${tweet.author?.userName || 'unknown'}: ${articleUrl}`);
      articleContent = await fetchArticleContent(articleUrl);
    }

    results.push({
      handle: tweet.author?.userName || tweet.user?.screen_name || 'unknown',
      text: tweet.text,
      likes: tweet.likeCount || tweet.favorite_count || 0,
      retweets: tweet.retweetCount || tweet.retweet_count || 0,
      url: tweet.url || tweet.permanentUrl,
      articleUrl: articleUrl || null,
      articleContent: articleContent || null,
    });
  }

  return results;
}
