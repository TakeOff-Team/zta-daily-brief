export function formatBrief(redditPosts, tweets, youtubeVideos, aiSummary, config) {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const briefName = config.briefName || 'Daily Brief';

  const redditSection = buildRedditSection(redditPosts);
  const twitterSection = buildTwitterSection(tweets);
  const youtubeSection = buildYouTubeSection(youtubeVideos);

  const contentAnglesSection = config.includeContentAngles
    ? `\n## Content Angles\n${aiSummary.contentAngles}\n`
    : '';

  const brief = `# ${briefName} — ${date}

## Top Story
${aiSummary.topStory}

## What People Are Saying
${aiSummary.whatPeopleSaying}

## Updates
${aiSummary.aiUpdates}

## New YouTube Videos
${youtubeSection}
${contentAnglesSection}
## Top Reddit Posts
${redditSection}

## Top X Posts
${twitterSection}

---
*${briefName} — ${new Date().toISOString()}*
`;

  return { brief, date };
}

function buildYouTubeSection(videos) {
  if (!videos.length) return '_No new videos from tracked channels today._';

  return videos
    .map(v => {
      const age = getAgeLabel(v.publishedAt);
      const summary = v.transcript
        ? `\n  Transcript available (${v.transcript.length} chars)`
        : '\n  No transcript available';
      return `- [${v.channelName}] "${v.title}" — posted ${age}\n  ${v.url}${summary}`;
    })
    .join('\n\n');
}

function buildRedditSection(posts) {
  if (!posts.length) return '_No Reddit data collected._';

  const bySubreddit = {};
  for (const post of posts) {
    const key = post.subreddit || 'general';
    if (!bySubreddit[key]) bySubreddit[key] = [];
    bySubreddit[key].push(post);
  }

  return Object.entries(bySubreddit)
    .map(([sub, subPosts]) => {
      const lines = subPosts
        .slice(0, 3)
        .map(p => `- ${p.title} | Score: ${p.score}`)
        .join('\n');
      return `[r/${sub}]\n${lines}`;
    })
    .join('\n\n');
}

function buildTwitterSection(tweets) {
  if (!tweets.length) return '_No Twitter data collected._';

  const byHandle = {};
  for (const tweet of tweets) {
    const key = tweet.handle || 'unknown';
    if (!byHandle[key]) byHandle[key] = [];
    byHandle[key].push(tweet);
  }

  return Object.entries(byHandle)
    .map(([handle, handleTweets]) => {
      const lines = handleTweets
        .slice(0, 2)
        .map(t => {
          if (t.articleUrl) {
            return `- [ARTICLE] ${t.text.slice(0, 120)} | Likes: ${t.likes.toLocaleString()}\n  ${t.articleUrl}`;
          }
          return `- ${t.text.slice(0, 120)} | Likes: ${t.likes.toLocaleString()}`;
        })
        .join('\n');
      return `[@${handle}]\n${lines}`;
    })
    .join('\n\n');
}

function getAgeLabel(publishedAt) {
  const hoursAgo = Math.round((Date.now() - publishedAt) / (1000 * 60 * 60));
  if (hoursAgo < 1) return 'just now';
  if (hoursAgo < 24) return `${hoursAgo}h ago`;
  return `${Math.round(hoursAgo / 24)}d ago`;
}
