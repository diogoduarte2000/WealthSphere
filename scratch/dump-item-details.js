const axios = require('axios');

async function test() {
  const steamId = '76561198235317356';
  const url = `https://steamcommunity.com/inventory/${steamId}/730/2?l=portuguese&count=2000`;
  
  try {
    console.log('Fetching inventory...');
    const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const descriptions = response.data.descriptions || [];
    
    // Find a sticker
    const stickers = descriptions.filter(d => d.market_hash_name && d.market_hash_name.includes('Sticker'));
    console.log(`Found ${stickers.length} stickers.`);
    if (stickers.length > 0) {
      console.log('Sticker Description sample:');
      console.log(JSON.stringify(stickers[0], null, 2));
    }
    
    // Find a charm
    const charms = descriptions.filter(d => d.market_hash_name && (d.market_hash_name.includes('Charm') || d.market_hash_name.includes('Slab') || d.type.includes('Charm') || d.type.includes('Detachment')));
    console.log(`Found ${charms.length} charms.`);
    if (charms.length > 0) {
      console.log('Charm Description sample:');
      console.log(JSON.stringify(charms[0], null, 2));
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
