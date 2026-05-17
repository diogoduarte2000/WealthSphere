const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  steamId: { type: String, unique: true, sparse: true },
  steamName: String, // Nome do perfil Steam
  steamAvatar: String, // Avatar do perfil Steam
  displayName: String,
  name: String, // Legacy support
  avatar: String,
  email: { type: String, unique: true, sparse: true },
  password: { type: String }, // New field
  passwordHash: String, // Legacy support
  inventory: { type: Array, default: [] },
  financialProfile: {
    netWorth: { type: Number, default: 0 },
    monthlyIncome: { type: Number, default: 0 },
    monthlyExpenses: { type: Number, default: 0 },
    etfPortfolio: { type: Number, default: 0 },
    realEstateValue: { type: Number, default: 0 },
    cryptoValue: { type: Number, default: 0 },
    history: [{
      date: { type: Date, default: Date.now },
      netWorth: Number,
      etfPortfolio: Number,
      realEstateValue: Number
    }]
  },
  lastLogin: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
