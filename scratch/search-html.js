const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'listing.html'), 'utf8');

// Find all matches for "Market_LoadOrderSpread" or "item_nameid" or look for scripts
console.log('Searching for g_rgWalletInfo:', html.includes('g_rgWalletInfo'));
console.log('Searching for item_nameid:', html.includes('item_nameid'));
console.log('Searching for LoadOrderSpread:', html.includes('LoadOrderSpread'));

// Find script tags that contain "Market_"
const scripts = html.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/g) || [];
console.log('Total scripts found:', scripts.length);

let foundMatches = [];
scripts.forEach(script => {
  if (script.includes('Market_')) {
    foundMatches.push(script.substring(0, 200) + '...');
  }
});
console.log('Scripts with "Market_":', foundMatches);

// Let's print out lines containing "var " or "g_" inside script tags
scripts.forEach((script, idx) => {
  if (script.includes('var g_') || script.includes('item_nameid')) {
    console.log(`Script ${idx} contains var g_ or item_nameid. Snippet:`);
    console.log(script.substring(0, 500));
  }
});
