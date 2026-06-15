const axios = require('axios');

async function main() {
  try {
    console.log('Fetching Skinport items...');
    const response = await axios.get('https://api.skinport.com/v1/items', {
      params: { app_id: 730, currency: 'EUR' },
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
      timeout: 15000
    });
    
    console.log('Searching for "High Grade"...');
    const matches = response.data.filter(item => 
      item.market_hash_name.toLowerCase().includes('high grade')
    );
    
    console.log(`Found ${matches.length} matches.`);
    matches.slice(0, 10).forEach(item => {
      console.log(`- ${item.market_hash_name} (Price: €${item.suggested_price})`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
