const axios = require('axios');

async function test() {
  const steamId = '76561198020822606';
  const url = `https://steamcommunity.com/inventory/${steamId}/730/2?l=portuguese&count=2000`;
  
  try {
    console.log('Fetching inventory for', steamId);
    const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const descriptions = response.data.descriptions || [];
    
    console.log('Searching for item names starting with "G" followed by digits...');
    const customItems = descriptions.filter(d => d.market_hash_name && /^[Gg]\d+/.test(d.market_hash_name));
    console.log(`Found ${customItems.length} custom items.`);
    
    customItems.forEach((item, idx) => {
      console.log(`\nCustom Item ${idx + 1}:`);
      console.log('market_hash_name:', item.market_hash_name);
      console.log('name:', item.name);
      console.log('market_name:', item.market_name);
      console.log('type:', item.type);
      console.log('market_bucket_group_name:', item.market_bucket_group_name);
      console.log('market_bucket_group_id:', item.market_bucket_group_id);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
