export async function scrapeReddit(config) {
  const { subreddits = [], postsPerSubreddit = 15 } = config.reddit;
  const windowHours = config._windowHours || 24;
  const cutoff = Date.now() - windowHours * 60 * 60 * 1000;

  const results = [];

  for (const sub of subreddits) {
    try {
      const url = `https://www.reddit.com/r/${sub}/new.json?limit=${postsPerSubreddit}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'daily-brief/1.0.0 (https://github.com/TakeOff-Team/zta-daily-brief)',
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        console.error(`  Reddit r/${sub} failed (${res.status})`);
        continue;
      }

      const json = await res.json();
      const posts = json?.data?.children || [];

      for (const { data: post } of posts) {
        const postTime = post.created_utc * 1000;
        if (postTime < cutoff) continue;
        if (!post.title) continue;

        results.push({
          subreddit: post.subreddit,
          title: post.title,
          score: post.score || 0,
          comments: post.num_comments || 0,
          url: `https://reddit.com${post.permalink}`,
          text: post.selftext ? post.selftext.slice(0, 300) : '',
        });
      }

      console.log(`  r/${sub}: ${posts.filter(p => p.data.created_utc * 1000 >= cutoff).length} posts in last ${windowHours}h`);
    } catch (err) {
      console.error(`  Reddit r/${sub} error: ${err.message}`);
    }
  }

  return results;
}
