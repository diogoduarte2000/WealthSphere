const axios = require('axios');

async function test() {
  const steamId = '76561198020822606';
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
    
    console.log('Status:', response.status);
    console.log('Has assets:', Array.isArray(response.data?.assets) ? response.data.assets.length : 'no');
    console.log('Has descriptions:', Array.isArray(response.data?.descriptions) ? response.data.descriptions.length : 'no');
    
    const descriptions = Array.isArray(response.data?.descriptions) ? response.data.descriptions : [];
    const assets = Array.isArray(response.data?.assets) ? response.data.assets : [];
    
    const descriptionsByAsset = new Map(descriptions.map((desc) => [`${desc.classid}_${desc.instanceid}`, desc]));
    const items = assets.map((asset) => {
      const desc = descriptionsByAsset.get(`${asset.classid}_${asset.instanceid}`) || {};
      return {
        name: desc.market_hash_name,
        type: desc.type
      };
    }).filter((item) => item.name);
    
    console.log(`Mapped items: ${items.length}`);
  } catch(e) {
    console.error('Error:', e.message);
    if(e.response) console.error('Data:', e.response.data);
  }
}

test();
