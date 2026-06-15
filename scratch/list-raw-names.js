const axios = require('axios');

async function test() {
  const steamId = '76561198235317356';
  const url = `https://steamcommunity.com/inventory/${steamId}/730/2?l=portuguese&count=2000`;
  
  try {
    console.log('Fetching inventory...');
    const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const descriptions = response.data.descriptions || [];
    
    console.log('Total descriptions:', descriptions.length);
    
    descriptions.forEach((d, idx) => {
      console.log(`${idx + 1}. market_hash_name: "${d.market_hash_name}" | name: "${d.name}" | market_name: "${d.market_name}"`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
