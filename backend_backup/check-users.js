const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('./src/models/User');

async function checkUsers() {
  try {
    const uri = process.env.MONGO_URI.replace('/wealthsphere', '/');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
    
    const users = await User.find({}, 'name email role');
    console.log('Users found:', users.length);
    users.forEach(u => console.log(`- ${u.name} (${u.email}) [${u.role}]`));
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkUsers();
