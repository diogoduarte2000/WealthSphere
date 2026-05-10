const jwt = require('jsonwebtoken');

const env = require('../config/env');
const User = require('../models/User');
const asyncHandler = require('./asyncHandler');

const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    const error = new Error('Authorization token missing');
    error.statusCode = 401;
    throw error;
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub);

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 401;
      throw error;
    }

    req.user = user;
    next();
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 401;
      error.message = 'Invalid or expired token';
    }

    throw error;
  }
});

module.exports = {
  requireAuth
};
