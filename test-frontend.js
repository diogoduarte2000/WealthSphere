const puppeteer = require('puppeteer');

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  
  console.log('Navigating to frontend...');
  await page.goto('http://localhost:4200', { waitUntil: 'networkidle0' });
  
  console.log('Taking screenshot...');
  await page.screenshot({ path: 'frontend-test.png' });
  
  const html = await page.content();
  if (html.includes('Inventário')) {
    console.log('Page loaded properly.');
  } else {
    console.log('Page might not be fully loaded.');
  }
  
  await browser.close();
  console.log('Done.');
}

run().catch(console.error);
