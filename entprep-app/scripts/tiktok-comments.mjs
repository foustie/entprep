#!/usr/bin/env node
/**
 * Fetch all TikTok comments from @diyarbuilds via Apify.
 *
 * Setup:
 *   1. Register at apify.com ($5 free credits)
 *   2. Get API token from apify.com/account/integrations
 *   3. Add APIFY_TOKEN=... to .env
 *
 * Usage:
 *   node scripts/tiktok-comments.mjs                    # fetch + save
 *   node scripts/tiktok-comments.mjs --analyze          # fetch + analyze via Claude
 *   node scripts/tiktok-comments.mjs --username=foo     # different username
 *   node scripts/tiktok-comments.mjs --per-video=200    # more comments per video
 *
 * Output: tiktok-comments.json (videos + comments, raw)
 *         tiktok-analysis.md (if --analyze)
 *
 * Cost: ~$0.20-0.50 per run for 15 videos (~50-100 comments each)
 */

import fs from 'fs';

// ── Env ──────────────────────────────────────────────────────────────────

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const APIFY_TOKEN = env.APIFY_TOKEN || process.env.APIFY_TOKEN;
const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY;

if (!APIFY_TOKEN) {
  console.error('Missing APIFY_TOKEN in .env');
  console.error('Get one at: https://console.apify.com/account/integrations');
  process.exit(1);
}

// ── CLI args ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const ANALYZE = args.includes('--analyze');
const USERNAME = args.find(a => a.startsWith('--username='))?.split('=')[1] || 'diyarbuilds';
const PER_VIDEO = parseInt(args.find(a => a.startsWith('--per-video='))?.split('=')[1] || '100');

console.log(`Fetching TikTok data for @${USERNAME}...`);
console.log(`Comments per video: ${PER_VIDEO}`);

// ── Step 1: Fetch profile videos ─────────────────────────────────────────

async function runActor(actorId, input) {
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Apify ${actorId} failed ${res.status}: ${err.substring(0, 300)}`);
  }

  return res.json();
}

console.log('\n[1/2] Fetching profile videos...');

const videos = await runActor('clockworks~tiktok-scraper', {
  profiles: [USERNAME],
  resultsPerPage: 50,
  shouldDownloadVideos: false,
  shouldDownloadCovers: false,
  shouldDownloadSubtitles: false,
});

console.log(`  Found ${videos.length} videos`);

const videoUrls = videos.map(v => v.webVideoUrl).filter(Boolean);

if (videoUrls.length === 0) {
  console.error('No videos found. Check username or Apify credits.');
  process.exit(1);
}

// ── Step 2: Fetch comments for each video ────────────────────────────────

console.log(`\n[2/2] Fetching comments for ${videoUrls.length} videos...`);

const comments = await runActor('clockworks~tiktok-comments-scraper', {
  postURLs: videoUrls,
  commentsPerPost: PER_VIDEO,
  maxRepliesPerComment: 5,
});

console.log(`  Fetched ${comments.length} comments`);

// ── Merge and save ──────────────────────────────────────────────────────

const byVideo = {};
for (const c of comments) {
  const url = c.videoWebUrl || c.submittedVideoUrl || 'unknown';
  if (!byVideo[url]) byVideo[url] = [];
  byVideo[url].push({
    text: c.text,
    likes: c.diggCount || 0,
    author: c.uniqueId || c.nickname || '?',
    replies: c.repliesCount || 0,
    createTime: c.createTimeISO,
  });
}

const result = {
  username: USERNAME,
  fetchedAt: new Date().toISOString(),
  totalVideos: videos.length,
  totalComments: comments.length,
  videos: videos.map(v => ({
    url: v.webVideoUrl,
    text: v.text,
    views: v.playCount,
    likes: v.diggCount,
    shares: v.shareCount,
    commentsCount: v.commentCount,
    createdAt: v.createTimeISO,
    comments: byVideo[v.webVideoUrl] || [],
  })),
};

fs.writeFileSync('tiktok-comments.json', JSON.stringify(result, null, 2));
console.log('\nSaved: tiktok-comments.json');

// ── Summary ──────────────────────────────────────────────────────────────

console.log('\n━━━ Summary ━━━');
console.log(`Videos: ${result.totalVideos}`);
console.log(`Total views: ${result.videos.reduce((s, v) => s + (v.views || 0), 0).toLocaleString()}`);
console.log(`Total comments: ${result.totalComments}`);

const topVideos = [...result.videos].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 3);
console.log('\nTop 3 by views:');
for (const v of topVideos) {
  console.log(`  ${(v.views || 0).toLocaleString()} views, ${v.commentsCount || 0} comments — ${(v.text || '').substring(0, 60)}...`);
}

// ── Optional: Claude analysis ────────────────────────────────────────────

if (ANALYZE) {
  if (!ANTHROPIC_KEY) {
    console.error('\nANTHROPIC_API_KEY missing — skipping analysis');
    process.exit(0);
  }

  console.log('\n[3/3] Analyzing comments via Claude Sonnet...');

  const allComments = result.videos
    .flatMap(v => v.comments.map(c => ({ video: v.text?.substring(0, 60), ...c })))
    .filter(c => c.text && c.text.length > 3);

  if (allComments.length === 0) {
    console.log('  No comments to analyze.');
    process.exit(0);
  }

  const prompt = `Ты анализируешь комменты на TikTok аккаунте @${USERNAME} (ENTprep — бесплатная подготовка к ЕНТ в Казахстане).

Вот ${allComments.length} комментариев:

${allComments.map((c, i) => `${i+1}. [${c.likes || 0} лайков] @${c.author}: ${c.text}`).join('\n')}

Задача:
1. ПАТТЕРНЫ ЖАЛОБ — что юзеры пишут негативного или что НЕ работает?
2. ФИЧЕ-ЗАПРОСЫ — что просят добавить?
3. ПОЗИТИВ — что хвалят?
4. ВОПРОСЫ БЕЗ ОТВЕТА — на что Дияр не ответил?
5. ТОП-5 actionable инсайтов — что нужно починить/добавить в приложении

Ответь на русском, markdown, конкретно. Цитируй комменты (с автором) в качестве доказательств.`;

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!aiRes.ok) {
    console.error('Claude API error:', await aiRes.text());
    process.exit(1);
  }

  const data = await aiRes.json();
  const analysis = data.content?.[0]?.text || '';

  fs.writeFileSync('tiktok-analysis.md', `# TikTok Analysis @${USERNAME}\n\nFetched: ${result.fetchedAt}\n${result.totalVideos} videos, ${result.totalComments} comments\n\n---\n\n${analysis}\n`);
  console.log('\nSaved: tiktok-analysis.md');
  console.log('\n━━━ Analysis ━━━\n');
  console.log(analysis);
}
