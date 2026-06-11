const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'listing.html'), 'utf8');

// Search for history chart data in the HTML
// Steam charts usually define: var line1 = [...]
const lines = html.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('var line1') || line.includes('line1') || line.includes('price_median') || line.includes('priceHistory')) {
    console.log(`Line ${idx + 1}: ${line.substring(0, 300)}`);
  }
});
