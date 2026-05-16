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
  lastLogin: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
