const fs = require('fs');
const path = require('path');

const htmlFile = path.join(__dirname, '../site preview v1/wealthsphere-landing.html');
const stylesDest = path.join(__dirname, '../frontend/src/styles.css');
const componentDest = path.join(__dirname, '../frontend/src/app/app.component.html');
const indexDest = path.join(__dirname, '../frontend/src/index.html');

const content = fs.readFileSync(htmlFile, 'utf8');

// Extract styles
const styleMatch = content.match(/<style>([\s\S]*?)<\/style>/);
if (styleMatch) {
  let existingStyles = fs.existsSync(stylesDest) ? fs.readFileSync(stylesDest, 'utf8') : '';
  fs.writeFileSync(stylesDest, existingStyles + '\n' + styleMatch[1]);
}

// Extract body
let bodyMatch = content.match(/<body>([\s\S]*?)<\/body>/);
if (bodyMatch) {
  let bodyContent = bodyMatch[1];
  fs.writeFileSync(componentDest, bodyContent);
}

// Ensure the Google Fonts are in index.html
const indexContent = fs.readFileSync(indexDest, 'utf8');
if (!indexContent.includes('fonts.googleapis.com')) {
  const newIndex = indexContent.replace(
    '</head>',
    `  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet">\n</head>`
  );
  fs.writeFileSync(indexDest, newIndex);
}

console.log('Extraction complete!');
