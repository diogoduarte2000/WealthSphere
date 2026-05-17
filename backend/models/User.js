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
  trading212ApiKey: { type: String },
  binanceApiKey: { type: String },
  binanceApiSecret: { type: String },
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
    dueDate: Number, // day of the month
    rentAmount: Number,
    expenses: [{
      type: { type: String }, // e.g., 'Seguro', 'Obras'
      amount: Number,
      date: { type: Date, default: Date.now }
    }],
    // Novos campos baseados na especificação
    typology: String,
    location: String,
    currentValue: Number,
    status: { type: String, default: 'Arrendado' }, // Arrendado, Vazio, Próprio
    contract: {
      tenant: String,
      startDate: Date,
      endDate: Date,
      rentAmount: Number, // renda_base
      dueDate: Number,
      frequency: { type: String, default: 'Mensal' }
    },
    payments: [{
      amount: Number,
      dueDate: Date,
      paidDate: Date,
      status: { type: String, default: 'Agendado' } // Pago, Pendente, Atrasado, Agendado
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
  lastLogin: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
