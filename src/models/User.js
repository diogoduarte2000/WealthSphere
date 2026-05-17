const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 80
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true,
    select: false
  },
  avatar: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: '',
    maxlength: 280
  },
  role: {
    type: String,
    enum: ['visitor', 'member', 'contributor', 'expert'],
    default: 'member'
  },
  preferences: {
    isPortfolioPublic: {
      type: Boolean,
      default: false
    },
    favoriteTags: {
      type: [String],
      default: []
    }
  },
  refreshTokens: {
    type: [String],
    default: [],
    select: false
  }
}, {
  timestamps: true
});

userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    avatar: this.avatar,
    bio: this.bio,
    role: this.role,
    preferences: this.preferences,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('User', userSchema);
