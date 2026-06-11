const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: String,
  authorAvatar: String,
  content: { type: String, required: true },
  votes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: String,
  authorAvatar: String,
  content: { type: String, required: true },
  votes: { type: Number, default: 0 },
  upvotedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  downvotedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  replies: [replySchema],
  createdAt: { type: Date, default: Date.now }
});

const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: String,
  authorAvatar: String,
  authorFlair: String, // e.g. 'Expert ETFs', 'Landlord', 'Skin Trader', 'FIRE'
  title: { type: String, required: true },
  content: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['ETF & Ações', 'Imóveis & Rendas', 'CS2 & Steam', 'FIRE & Poupança', 'Cripto', 'Portugal & IRS', 'Novato'],
    default: 'Novato' 
  },
  tags: { type: [String], default: [] },
  votes: { type: Number, default: 0 },
  upvotedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  downvotedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  views: { type: Number, default: 0 },
  comments: [commentSchema],
  isPinned: { type: Boolean, default: false },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) } // 3 months
}, { timestamps: true });

// TTL index — MongoDB automatically removes expired posts
postSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Post', postSchema);
