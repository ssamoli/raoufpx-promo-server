// lead-radar/sources/upwork.js
// Uses Upwork's public RSS feed for job searches - no auth required
// ASCII-only

const https = require('https');

// Upwork public RSS search feeds
const FEEDS = [
  'https://www.upwork.com/ab/feed/jobs/rss?q=photographer+dubai&sort=recency',
  'https://www.upwork.com/ab/feed/jobs/rss?q=portrait+photography+dubai&sort=recency',
  'https://www.upwork.com/ab/feed/jobs/rss?q=photoshoot+dubai+uae&sort=recency',
];

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'LeadRadarBot/1.0',
        'Accept': 'application/rss+xml, text/xml'
      }
    };
    const req = https.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(httpsGet(res.headers.location));
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function parseRSSItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp('<' + tag + '(?:[^>]*)><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/' + tag + '>|<' + tag + '(?:[^>]*)>([\\s\\S]*?)<\\/' + tag + '>'));
      return m ? (m[1] || m[2] || '').trim() : '';
    };
    items.push({
      title: get('title'),
      link: get('link'),
      description: get('description').replace(/<[^>]+>/g, '').slice(0, 300),
      pubDate: get('pubDate'),
    });
  }
  return items;
}

async function scanUpwork() {
  const results = [];
  const seen = new Set();

  for (const feedUrl of FEEDS) {
    try {
      const xml = await httpsGet(feedUrl);
      const items = parseRSSItems(xml);

      items.forEach(item => {
        if (!item.link || seen.has(item.link)) return;
        seen.add(item.link);
        results.push({
          platform: 'upwork',
          username: 'Upwork Client',
          profile_or_post_link: item.link,
          location: 'Dubai / UAE (Upwork)',
          caption_or_title: item.title.slice(0, 200),
        });
      });

      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.warn('[upwork] Feed error:', e.message);
    }
  }

  return results;
}

module.exports = { scanUpwork };
