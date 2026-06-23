const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  steamId: { type: String, unique: true, sparse: true },
  steamName: String, // Nome do perfil Steam
  steamAvatar: String, // Avatar do perfil Steam
  displayName: String,
  name: String, // Legacy support
  avatar: String,
  nationality: String, // country code from registration (e.g. 'pt', 'br', 'en')
  email: { type: String, unique: true, sparse: true },
  password: { type: String, select: false }, // New field
  passwordHash: String, // Legacy support
  inventory: { type: Array, default: [] },
  trading212ApiKey: { type: String, select: false },
  trading212ApiSecret: { type: String, select: false },
  binanceApiKey: { type: String, select: false },
  binanceApiSecret: { type: String, select: false },
  krakenApiKey: { type: String, select: false },
  krakenApiSecret: { type: String, select: false },
  coinbaseApiKey: { type: String, select: false },
  coinbaseApiSecret: { type: String, select: false },
  wiseApiToken: { type: String, select: false },
  paypalClientId: { type: String, select: false },
  paypalClientSecret: { type: String, select: false },
  csFloatApiKey: { type: String, select: false },
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
  customSettings: {
    salary: { type: Number, default: 0 },
    freelance: { type: Number, default: 0 },
    supermarket: { type: Number, default: 0 },
    electricity: { type: Number, default: 0 },
    steamEarnings: { type: Number, default: 0 }
  },
  realEstate: [{
    name: String,
    dueDate: Number,
    rentAmount: Number,
    expenses: [{
      type: { type: String },
      amount: Number,
      date: { type: Date, default: Date.now }
    }],
    typology: String,
    location: String,
    currentValue: Number,
    status: { type: String, default: 'Arrendado' },
    contract: {
      tenant: String,
      startDate: Date,
      endDate: Date,
      rentAmount: Number,
      dueDate: Number,
      frequency: { type: String, default: 'Mensal' }
    },
    payments: [{
      amount: Number,
      dueDate: Date,
      paidDate: Date,
      status: { type: String, default: 'Agendado' }
    }],
    credit: {
      bank: String,
      outstandingCapital: Number,
      capitalPaid: Number,
      monthlyPayment: Number,
      spread: Number,
      term: Number,
      startDate: Date
    }
  }],
  financialGoals: [{
    label: { type: String, required: true },
    target: { type: Number, required: true },
    deadline: String,
    notified: { type: Boolean, default: false }
  }],
  transactions: [{
    type: { type: String, enum: ['receita', 'despesa'], required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    category: String,
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    createdAt: { type: Date, default: Date.now }
  }],
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
    nationality: this.nationality || '',
    inventory: this.inventory,
    financialProfile: this.financialProfile,
    customSettings: this.customSettings,
    realEstate: this.realEstate,
    financialGoals: this.financialGoals || [],
    hasTrading212ApiKey: !!this.trading212ApiKey,
    hasTrading212ApiSecret: !!this.trading212ApiSecret,
    hasBinanceApiKey: !!this.binanceApiKey,
    hasKrakenApiKey: !!this.krakenApiKey,
    hasCoinbaseApiKey: !!this.coinbaseApiKey,
    hasWiseApiToken: !!this.wiseApiToken,
    hasPaypalClientId: !!this.paypalClientId,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('User', userSchema);
