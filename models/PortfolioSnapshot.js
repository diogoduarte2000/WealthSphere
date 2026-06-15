const mongoose = require('mongoose');

const snapshotSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD'
  total: { type: Number, required: true },
  positionsValue: { type: Number, default: 0 },
  cash: { type: Number, default: 0 },
  invested: { type: Number, default: 0 },
  result: { type: Number, default: 0 },
  source: { type: String, default: 'trading212' },
  createdAt: { type: Date, default: Date.now }
});

// Unique snapshot per user per day per source
snapshotSchema.index({ user: 1, date: 1, source: 1 }, { unique: true });

module.exports = mongoose.model('PortfolioSnapshot', snapshotSchema);
