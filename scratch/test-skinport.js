const axios = require('axios');

async function main() {
  try {
    console.log('Fetching Skinport items...');
    const response = await axios.get('https://api.skinport.com/v1/items', {
      params: {
        app_id: 730,
        currency: 'EUR'
      },
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000
    });
    console.log('Success! Total items:', response.data.length);
    console.log('First item sample:', response.data[0]);
    
    // Find some sticker or charm in the response
    const sticker = response.data.find(item => item.market_hash_name.toLowerCase().includes('sticker') || item.market_hash_name.toLowerCase().includes('charm'));
    console.log('Sample sticker/charm:', sticker);
  } catch (err) {
    console.error('Error fetching Skinport items:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    }
  }
}

main();
