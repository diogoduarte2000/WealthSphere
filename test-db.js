const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const User = require('./models/User');
  const user = await User.findOne({ steamId: { $exists: true, $ne: null } });
  if (!user) {
    console.log('No user with steamId found');
    process.exit(0);
  }
  console.log('Testing with steamId:', user.steamId);

  try {
    const inventoryUrl = `https://steamcommunity.com/inventory/${user.steamId}/730/2?l=portuguese&count=2000`;
    const response = await axios.get(inventoryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    const descriptions = Array.isArray(response.data?.descriptions) ? response.data.descriptions : [];
    const assets = Array.isArray(response.data?.assets) ? response.data.assets : [];
    console.log(`Found ${assets.length} assets and ${descriptions.length} descriptions`);

    const descriptionsByAsset = new Map(descriptions.map((desc) => [`${desc.classid}_${desc.instanceid}`, desc]));
    const items = assets.map((asset) => {
      const desc = descriptionsByAsset.get(`${asset.classid}_${asset.instanceid}`) || {};
      return {
        name: desc.market_hash_name,
        type: desc.type
      };
    }).filter((item) => item.name);

    console.log(`Mapped to ${items.length} items`);
    console.log(items.slice(0, 3));
  } catch (err) {
    console.error('Error fetching inventory:', err.message);
    if (err.response) console.error(err.response.data);
  }
  process.exit(0);
});
