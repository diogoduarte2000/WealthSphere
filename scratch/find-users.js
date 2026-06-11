const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', 'backend', '.env');
require('dotenv').config({ path: envPath });

async function main() {
  try {
    console.log('Connecting to MongoDB at:', process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');
    
    // Load models
    const User = require('../models/User');
    
    const users = await User.find({}, 'displayName email steamId steamName');
    console.log('Found users:');
    console.log(JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
