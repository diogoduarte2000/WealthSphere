const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  steamId: { type: String, unique: true, sparse: true },
  steamName: String, // Nome do perfil Steam
  steamAvatar: String, // Avatar do perfil Steam
  displayName: String,
  name: String, // Legacy support
  avatar: String,
  email: { type: String, unique: true, sparse: true },
  password: { type: String, select: false }, // New field
  passwordHash: String, // Legacy support
  inventory: { type: Array, default: [] },
  refreshTokens: {
    type: [String],
    default: [],
    select: false
  },
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

userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id,
    steamId: this.steamId,
    steamName: this.steamName,
    steamAvatar: this.steamAvatar,
    displayName: this.displayName || this.name || '',
    name: this.displayName || this.name || '',
    avatar: this.avatar,
    email: this.email,
    inventory: this.inventory,
    financialProfile: this.financialProfile,
    customSettings: this.customSettings,
    realEstate: this.realEstate,
    hasTrading212ApiKey: !!this.trading212ApiKey,
    hasBinanceApiKey: !!this.binanceApiKey,
    hasBinanceApiSecret: !!this.binanceApiSecret,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('User', userSchema);
