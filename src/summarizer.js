import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function generateBrief(redditPosts, tweets, youtubeVideos, config) {
  const briefName = config.briefName || 'Daily Brief';
  const briefDescription = config.briefDescription || 'a daily brief for staying informed';
  const audience = config.audience || 'professionals who want to stay informed on this topic';
  const includeContentAngles = config.includeContentAngles !== false ? config.includeContentAngles : false;

  const redditSummary = redditPosts
    .slice(0, 20)
    .map(p => `[r/${p.subreddit}] "${p.title}" — Score: ${p.score}, Comments: ${p.comments}${p.text ? `\n  "${p.text}"` : ''}`)
    .join('\n');

  const twitterSummary = tweets
    .slice(0, 20)
    .map(t => {
      if (t.articleUrl) {
        return `@${t.handle} [ARTICLE]: "${t.text}" — Likes: ${t.likes}\n  Article content: "${t.articleContent?.slice(0, 800) || 'content unavailable'}"`;
      }
      return `@${t.handle}: "${t.text}" — Likes: ${t.likes}`;
    })
    .join('\n');

  const youtubeSummary = youtubeVideos
    .map(v => `[${v.channelName}] "${v.title}"\n${v.transcript ? `Transcript excerpt: "${v.transcript.slice(0, 500)}"` : '(no transcript)'}`)
    .join('\n\n');

  const prompt = `You are the editor of "${briefName}" — ${briefDescription}.

Your audience: ${audience}

Here is today's raw signal:

## Reddit Posts
${redditSummary || 'No Reddit data available.'}

## X/Twitter Posts
${twitterSummary || 'No Twitter data available.'}

## New YouTube Videos
${youtubeSummary || 'No new YouTube videos today.'}

Based on this data, produce the following sections for today's brief:

1. TOP_STORY: The single biggest story or shift happening right now. 2-3 sentences. Be specific — name the thing, explain why it matters to your audience.

2. WHAT_PEOPLE_ARE_SAYING: 3 bullet points of real signal from the data. What are people actually talking about? Quote or paraphrase specific posts/comments where possible. No generic observations.

3. NOTABLE_UPDATES: 3-5 bullet points of specific news from the past 24 hours — new releases, feature launches, major announcements. Only include things that are clearly new/announced recently. If there's nothing concrete in the data, say "No major updates in this window." Be specific: name the thing, what changed, why it matters in one sentence.
${includeContentAngles ? `
4. CONTENT_ANGLES: 3 specific content angles relevant to this niche for ${audience}. Each angle should include the hook framed out (the first sentence or headline), not just a topic name.
` : ''}
Format your response exactly as:
TOP_STORY:
[your top story here]

WHAT_PEOPLE_ARE_SAYING:
- [observation 1]
- [observation 2]
- [observation 3]

NOTABLE_UPDATES:
- [update 1]
- [update 2]
- [update 3]
${includeContentAngles ? `
CONTENT_ANGLES:
- [hook/angle 1]
- [hook/angle 2]
- [hook/angle 3]` : ''}`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].text;

  const extract = (label) => {
    const regex = new RegExp(`${label}:\\n([\\s\\S]*?)(?=\\n[A-Z_]+:|$)`);
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

  return {
    topStory: extract('TOP_STORY'),
    whatPeopleSaying: extract('WHAT_PEOPLE_ARE_SAYING'),
    aiUpdates: extract('NOTABLE_UPDATES'),
    contentAngles: extract('CONTENT_ANGLES'),
  };
}
