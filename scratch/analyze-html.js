const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'listing.html'), 'utf8');

const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
console.log('Title:', titleMatch ? titleMatch[1] : 'No title');

console.log('First 500 chars:');
console.log(html.substring(0, 500));

console.log('Contains "Sign In":', html.includes('Sign In'));
console.log('Contains "Too Many Requests":', html.includes('Too Many Requests') || html.includes('429'));
