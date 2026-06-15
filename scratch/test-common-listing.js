const axios = require('axios');

async function main() {
  // Let's fetch Snakebite Case listing page
  const name = 'Snakebite Case';
  const url = `https://steamcommunity.com/market/listings/730/${encodeURIComponent(name)}`;
  console.log('Fetching:', url);
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000
    });
    const html = response.data;
    console.log('HTML Length:', html.length);
    
    // Search for item_nameid
    const nameidMatch = html.match(/Market_LoadOrderSpread\(\s*(\d+)\s*\)/);
    console.log('Market_LoadOrderSpread match:', nameidMatch);
    
    // Search for line1 (price history)
    const line1Match = html.match(/var line1\s*=\s*(\[.*?\]);/);
    console.log('line1 match:', line1Match ? 'found (length: ' + line1Match[1].length + ')' : 'not found');
    
    // Check if it's rate limited
    if (html.includes('Too Many Requests') || html.includes('429')) {
      console.log('We got 429 Rate Limited!');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
