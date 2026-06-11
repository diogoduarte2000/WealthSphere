const axios = require('axios');

async function main() {
  try {
    console.log('Fetching Skinport items...');
    const response = await axios.get('https://api.skinport.com/v1/items', {
      params: { app_id: 730, currency: 'EUR' },
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
      timeout: 15000
    });
    
    console.log('Searching for "Sticker Slab"...');
    const stickerSlabs = response.data.filter(item => item.market_hash_name.toLowerCase().includes('sticker slab'));
    console.log('Sticker Slabs found:', stickerSlabs.length);
    if (stickerSlabs.length > 0) {
      console.log(stickerSlabs.slice(0, 5));
    }
    
    console.log('Searching for "Customized"...');
    const customized = response.data.filter(item => item.market_hash_name.toLowerCase().includes('customized'));
    console.log('Customized found:', customized.length);
    if (customized.length > 0) {
      console.log(customized.slice(0, 5));
    }
    
    console.log('Searching for "High Grade Charm"...');
    const charms = response.data.filter(item => item.market_hash_name.toLowerCase().includes('high grade charm'));
    console.log('High Grade Charms found:', charms.length);
    if (charms.length > 0) {
      console.log(charms.slice(0, 5));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
