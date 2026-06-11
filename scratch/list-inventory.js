const axios = require('axios');

async function test() {
  const steamId = '76561198235317356';
  const inventoryUrl = `https://steamcommunity.com/inventory/${steamId}/730/2?l=portuguese&count=2000`;
  
  try {
    console.log('Fetching', inventoryUrl);
    const response = await axios.get(inventoryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    const descriptions = Array.isArray(response.data?.descriptions) ? response.data.descriptions : [];
    const assets = Array.isArray(response.data?.assets) ? response.data.assets : [];
    
    const descriptionsByAsset = new Map(descriptions.map((desc) => [`${desc.classid}_${desc.instanceid}`, desc]));
    const items = assets.map((asset) => {
      const desc = descriptionsByAsset.get(`${asset.classid}_${asset.instanceid}`) || {};
      return {
        name: desc.market_hash_name,
        type: desc.type,
        tradable: desc.tradable,
        marketable: desc.marketable
      };
    }).filter((item) => item.name);
    
    console.log(`Mapped items: ${items.length}`);
    console.log('--- Item list ---');
    items.forEach((item, idx) => {
      console.log(`${idx + 1}. [${item.name}] | Type: ${item.type} | Tradable: ${item.tradable} | Marketable: ${item.marketable}`);
    });
  } catch(e) {
    console.error('Error:', e.message);
  }
}

test();
