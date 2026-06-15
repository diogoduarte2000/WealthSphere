const mongoose = require('mongoose');

async function connectDatabase(mongoUri) {
  try {
    await mongoose.connect(mongoUri);
    return { connected: true };
  } catch (error) {
    return { connected: false, error };
  }
}

module.exports = {
  connectDatabase,
  mongoose
};
