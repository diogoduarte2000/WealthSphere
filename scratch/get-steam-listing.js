const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function main() {
  const url = 'https://steamcommunity.com/market/listings/730/G188909300462050800108239';
  console.log('Fetching:', url);
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,pt-PT;q=0.8,pt;q=0.7'
      },
      timeout: 10000
    });
    
    const html = response.data;
    console.log('HTML Length:', html.length);
    
    // Save to scratch for analysis
    const filePath = path.join(__dirname, 'listing.html');
    fs.writeFileSync(filePath, html);
    console.log('Saved to scratch/listing.html');
    
    // Search for Market_LoadOrderSpread or item_nameid
    const nameidMatch = html.match(/Market_LoadOrderSpread\(\s*(\d+)\s*\)/);
    console.log('Market_LoadOrderSpread match:', nameidMatch);
    
    // Search for WalletInfo or other variables
    const walletMatch = html.match(/var g_rgWalletInfo = (\{.*?\});/);
    console.log('WalletInfo match:', walletMatch ? 'found' : 'not found');
    
    // Search for the word "buy order" or "pedidos" or similar in the text
    const buyOrdersText = html.match(/buy orders/i);
    console.log('Buy orders text found:', !!buyOrdersText);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
