import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export async function scrapeYouTube(config) {
  const channels = config.youtube?.channels || [];
  if (!channels.length) return [];

  const windowHours = config._windowHours || 24;
  const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
  const results = [];

  for (const channel of channels) {
    try {
      const videos = await getNewVideos(channel, cutoff);
      if (!videos.length) {
        console.log(`  No new videos from ${channel.id || channel}`);
        continue;
      }
      for (const video of videos) {
        console.log(`  Found: "${video.title}" — fetching transcript...`);
        const transcript = getTranscript(video.videoId);
        results.push({ ...video, transcript });
      }
    } catch (err) {
      console.error(`YouTube scrape failed for ${JSON.stringify(channel)}:`, err.message);
    }
  }

  return results;
}

async function getNewVideos(channel, cutoff) {
  // Accept either a channel ID string or { id, name } object
  const channelId = typeof channel === 'string' ? channel : channel.id;

  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`RSS fetch failed (${response.status}) for channel ${channelId}`);

  const xml = await response.text();
  const entries = parseRSSEntries(xml);

  return entries.filter(e => e.publishedAt >= cutoff);
}

function parseRSSEntries(xml) {
  const entries = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const videoId = (entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    const title = (entry.match(/<title>([^<]+)<\/title>/) || [])[1];
    const published = (entry.match(/<published>([^<]+)<\/published>/) || [])[1];
    const channelName = (entry.match(/<name>([^<]+)<\/name>/) || [])[1] || '';

    if (videoId && title && published) {
      entries.push({
        videoId,
        title: decodeXmlEntities(title),
        channelName: decodeXmlEntities(channelName),
        publishedAt: new Date(published).getTime(),
        url: `https://www.youtube.com/watch?v=${videoId}`,
      });
    }
  }

  return entries;
}

function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function getTranscript(videoId) {
  const tmpDir = os.tmpdir();
  const prefix = path.join(tmpDir, `yt-${videoId}`);
  const vttFile = `${prefix}.en.vtt`;

  try {
    execSync(
      `yt-dlp --skip-download --write-auto-sub --sub-lang en --sub-format vtt -o "${prefix}" "https://www.youtube.com/watch?v=${videoId}"`,
      { timeout: 30000, stdio: 'pipe' }
    );

    if (!fs.existsSync(vttFile)) return null;

    const vtt = fs.readFileSync(vttFile, 'utf8');
    fs.unlinkSync(vttFile);

    // Strip VTT headers, timestamps, and tags — return plain text capped at 3000 chars
    return vtt
      .replace(/WEBVTT[\s\S]*?\n\n/, '')
      .replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> [^\n]+\n/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 3000);
  } catch {
    return null;
  }
}
