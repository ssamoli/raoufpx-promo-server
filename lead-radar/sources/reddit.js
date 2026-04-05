// lead-radar/sources/reddit.js
// Uses Reddit's public JSON API - no auth required
// ASCII-only

const https = require('https');

const SUBREDDITS = ['dubai', 'UAE', 'DubaiExpats'];
const KEYWORDS = [
  'photographer',
  'photoshoot',
  'portrait photographer',
  'engagement shoot',
  'need photographer',
  'looking for photographer',
  'wedding photographer',
  'photography session'
];

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'LeadRadarBot/1.0 (photography lead tracking)'
      }
    };
    const req = https.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(httpsGet(res.headers.location));
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function scanSubreddit(subreddit) {
  const url = 'https://www.reddit.com/r/' + subreddit + '/search.json?q=photographer+dubai&sort=new&limit=25&restrict_sr=false&t=week';
  const data = await httpsGet(url);

  if (!data || !data.data || !data.data.children) return [];

  return data.data.children
    .map(child => child.data)
    .filter(post => {
      if (!post || post.over_18) return false;
      const text = ((post.title || '') + ' ' + (post.selftext || '')).toLowerCase();
      return KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
    })
    .map(post => ({
      platform: 'reddit',
      username: 'u/' + (post.author || 'unknown'),
      profile_or_post_link: 'https://reddit.com' + (post.permalink || ''),
      location: 'r/' + subreddit + ' (Dubai)',
      caption_or_title: (post.title || '').slice(0, 200),
    }));
}

async function scanReddit() {
  const results = [];
  for (const sub of SUBREDDITS) {
    try {
      const leads = await scanSubreddit(sub);
      results.push(...leads);
      // Polite delay between subreddits
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.warn('[reddit] Error scanning r/' + sub + ':', e.message);
    }
  }
  return results;
}

module.exports = { scanReddit };
