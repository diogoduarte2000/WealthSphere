const axios = require('axios');

async function test() {
  const steamId = '76562198235317356'; // wait, the correct one from the DB was 76561198235317356
  const correctSteamId = '76561198235317356';
  
  try {
    console.log('Fetching Skinport database (EUR)...');
    const skinportResponse = await axios.get('https://api.skinport.com/v1/items', {
      params: { app_id: 730, currency: 'EUR' },
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
      timeout: 20000
    });
    const skinportItems = skinportResponse.data;
    console.log(`Fetched ${skinportItems.length} items from Skinport.`);
    
    // Create a map for quick lookups
    const priceMap = new Map(skinportItems.map(item => [item.market_hash_name, item]));
    
    console.log('Fetching inventory for:', correctSteamId);
    const invResponse = await axios.get(`https://steamcommunity.com/inventory/${correctSteamId}/730/2?l=portuguese&count=2000`, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    const descriptions = Array.isArray(invResponse.data?.descriptions) ? invResponse.data.descriptions : [];
    const assets = Array.isArray(invResponse.data?.assets) ? invResponse.data.assets : [];
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
    
    console.log(`\nInventory size: ${items.length}`);
    console.log('Matching with Skinport:');
    let matched = 0;
    let notMatched = 0;
    
    for (const item of items) {
      if (!item.marketable) {
        console.log(`[Non-Marketable] ${item.name} | Type: ${item.type}`);
        continue;
      }
      
      const spData = priceMap.get(item.name);
      if (spData) {
        matched++;
        console.log(`[MATCH] ${item.name} -> Suggested Price: €${spData.suggested_price} | Min Price: €${spData.min_price} | Median Price: €${spData.median_price}`);
      } else {
        notMatched++;
        console.log(`[NOT FOUND] ${item.name}`);
      }
    }
    
    console.log(`\nMatched: ${matched}, Not Matched: ${notMatched}`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
