// lead-radar/sources/instagram.js
// STUB - Instagram location data requires app review via Meta Graph API
// When you get a token, fill in ACCESS_TOKEN and uncomment the real logic
// ASCII-only

// const ACCESS_TOKEN = process.env.INSTAGRAM_TOKEN || '';

async function scanInstagram() {
  // Instagram Basic Display API or Graph API requires:
  // 1. A Meta Developer App (free to create at developers.facebook.com)
  // 2. App Review for instagram_basic or instagram_manage_insights
  // 3. A long-lived user token
  //
  // Once you have ACCESS_TOKEN, use:
  // GET https://graph.instagram.com/v18.0/ig_hashtag_search
  //   ?user_id=YOUR_USER_ID&q=dubaiportraitphotography&access_token=TOKEN
  //
  // Then:
  // GET https://graph.instagram.com/v18.0/{hashtag-id}/recent_media
  //   ?user_id=YOUR_USER_ID&fields=id,caption,permalink,timestamp&access_token=TOKEN
  //
  // Filter captions for: "looking for photographer", "need photographer", etc.

  console.log('[instagram] Stub active - no token configured. Skipping.');
  return [];
}

module.exports = { scanInstagram };
