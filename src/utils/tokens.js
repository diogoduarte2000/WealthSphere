const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const env = require('../config/env');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createAccessToken(user) {
  return jwt.sign(
    {
      email: user.email,
      role: user.role
    },
    env.jwtSecret,
    {
      subject: String(user._id),
      expiresIn: env.accessTokenTtl
    }
  );
}

function createRefreshToken(user) {
  return jwt.sign(
    {
      type: 'refresh'
    },
    env.jwtSecret,
    {
      subject: String(user._id),
      expiresIn: env.refreshTokenTtl
    }
  );
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

module.exports = {
  hashToken,
  createAccessToken,
  createRefreshToken,
  verifyToken
};
