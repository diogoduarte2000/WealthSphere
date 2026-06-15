const axios = require('axios');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', 'backend', '.env');
require('dotenv').config({ path: envPath });

// Replicate logic from server.js
const skinportCache = {
  data: new Map(),
  lastUpdated: 0
};
let skinportUpdatePromise = null;

function parseMarketPrice(priceStr) {
  const cleaned = String(priceStr || '').replace(/&nbsp;/g, '').replace(/\s/g, '').replace(/[^\d.,]/g, '');
  if (!cleaned) return null;

  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function updateSkinportCache() {
  if (skinportUpdatePromise) return skinportUpdatePromise;

  skinportUpdatePromise = (async () => {
    try {
      console.log('Updating Skinport price cache...');
      const response = await axios.get('https://api.skinport.com/v1/items', {
        params: { app_id: 730, currency: 'EUR' },
        headers: {
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 30000
      });

      if (Array.isArray(response.data)) {
        const newMap = new Map();
        response.data.forEach(item => {
          newMap.set(item.market_hash_name, item);
        });
        skinportCache.data = newMap;
        skinportCache.lastUpdated = Date.now();
        console.log(`Skinport price cache updated successfully with ${newMap.size} items.`);
        return true;
      }
    } catch (err) {
      console.error('Failed to update Skinport price cache:', err.message);
    } finally {
      skinportUpdatePromise = null;
    }
    return false;
  })();

  return skinportUpdatePromise;
}

async function getSkinportItem(name) {
  const cacheAge = Date.now() - skinportCache.lastUpdated;
  if (skinportCache.data.size === 0 || cacheAge > 12 * 60 * 60 * 1000) {
    if (skinportCache.data.size === 0) {
      await updateSkinportCache();
    } else {
      updateSkinportCache();
    }
  }
  return skinportCache.data.get(name) || null;
}

async function fetchSteamPriceOverview(name) {
  const url = `https://steamcommunity.com/market/priceoverview/`;
  const response = await axios.get(url, {
    params: { appid: 730, currency: 3, market_hash_name: name },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    timeout: 10000
  });

  if (response.data && response.data.success) {
    const data = response.data;
    const median = parseMarketPrice(data.median_price);
    const lowest = parseMarketPrice(data.lowest_price);
    const finalPrice = median ?? lowest;
    return {
      price: finalPrice,
      change24h: null,
      source: median ? 'steam-median' : (lowest ? 'steam-lowest' : 'steam-success')
    };
  }
  throw new Error('Steam priceoverview success was false');
}

function generateEstimatedPrice(name) {
  return 0.15; // mock simple estimator for tests
}

async function main() {
  const steamId = '76561198235317356';
  const url = `https://steamcommunity.com/inventory/${steamId}/730/2?l=portuguese&count=2000`;
  
  try {
    const startTime = Date.now();
    console.log('Fetching user inventory...');
    const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const descriptions = Array.isArray(response.data?.descriptions) ? response.data.descriptions : [];
    const assets = Array.isArray(response.data?.assets) ? response.data.assets : [];
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
    
    // Group unique items
    const itemGroups = new Map();
    items.forEach((item) => {
      const key = item.name;
      if (!itemGroups.has(key)) {
        itemGroups.set(key, { ...item, quantity: 0 });
      }
      const group = itemGroups.get(key);
      group.quantity++;
    });
    const uniqueItems = Array.from(itemGroups.values());
    console.log(`Inventory has ${items.length} total items (${uniqueItems.length} unique).`);
    
    // Process prices
    const itemsWithPrices = [];
    let skipped = 0;
    
    // Pre-warm cache
    await updateSkinportCache();
    const mapStartTime = Date.now();
    
    for (const item of uniqueItems) {
      if (!item.marketable) {
        itemsWithPrices.push({ ...item, price: null, source: 'skipped-non-marketable' });
        skipped++;
        continue;
      }
      
      const spData = await getSkinportItem(item.name);
      if (spData) {
        const price = spData.suggested_price ?? spData.min_price ?? spData.median_price ?? spData.mean_price ?? null;
        itemsWithPrices.push({ ...item, price, source: 'skinport' });
      } else {
        // Mock fallback to avoid hitting Steam API and getting 429 during automated verify tests
        itemsWithPrices.push({ ...item, price: 0.25, source: 'test-fallback' });
      }
    }
    
    console.log(`Mapped unique items in ${Date.now() - mapStartTime}ms.`);
    console.log(`Total run time: ${Date.now() - startTime}ms.`);
    
    console.log('\nSample items mapped:');
    itemsWithPrices.slice(0, 10).forEach(item => {
      console.log(`- "${item.name}" x${item.quantity} | Price: €${item.price} | Source: ${item.source}`);
    });
    
    console.log('\nNon-marketable sample items:');
    itemsWithPrices.filter(item => item.source === 'skipped-non-marketable').slice(0, 5).forEach(item => {
      console.log(`- "${item.name}" | Type: ${item.type} | Price: ${item.price} | Source: ${item.source}`);
    });
  } catch (err) {
    console.error('Error in test:', err.message);
  }
}

main();
