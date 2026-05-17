const mongoose = require('mongoose');

const ForumPostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { 
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    avatar: String
  },
  game: { type: String, default: 'CS2' },
  price: { type: Number },
  category: { type: String, enum: ['Venda', 'Compra', 'Troca', 'Discussão'], default: 'Discussão' },
  createdAt: { type: Date, default: Date.now },
  // Expira em 90 dias (TTL Index)
  expiresAt: { 
    type: Date, 
    default: () => new Date(+new Date() + 90*24*60*60*1000),
    index: { expires: 0 } // O MongoDB apaga o doc quando chega a esta data
  }
});

module.exports = ForumPostSchema;
