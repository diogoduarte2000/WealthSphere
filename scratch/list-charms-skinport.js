const axios = require('axios');

async function main() {
  try {
    console.log('Fetching Skinport items...');
    const response = await axios.get('https://api.skinport.com/v1/items', {
      params: { app_id: 730, currency: 'EUR' },
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
      timeout: 15000
    });
    
    console.log('Searching for "Charm" or "Slab"...');
    const matches = response.data.filter(item => 
      item.market_hash_name.toLowerCase().includes('charm') || 
      item.market_hash_name.toLowerCase().includes('slab')
    );
    
    console.log(`Found ${matches.length} matches.`);
    
    // Print unique prefixes or sample items
    const samples = matches.slice(0, 20);
    samples.forEach(item => {
      console.log(`- ${item.market_hash_name} (Price: €${item.suggested_price})`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
