const bcrypt = require('bcrypt');
const express = require('express');

const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { createAccessToken, createRefreshToken, hashToken, verifyToken } = require('../utils/tokens');

const router = express.Router();

function sanitizeEmail(email = '') {
  return email.trim().toLowerCase();
}

router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || String(name).trim().length < 2) {
    const error = new Error('Name must have at least 2 characters');
    error.statusCode = 400;
    throw error;
  }

  if (!email || !String(email).includes('@')) {
    const error = new Error('Valid email is required');
    error.statusCode = 400;
    throw error;
  }

  if (!password || String(password).length < 8) {
    const error = new Error('Password must have at least 8 characters');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = sanitizeEmail(email);
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    const error = new Error('Email already in use');
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash
  });

  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  user.refreshTokens = [hashToken(refreshToken)];
  await user.save();

  res.status(201).json({
    message: 'Account created successfully',
    user: user.toPublicJSON(),
    tokens: {
      accessToken,
      refreshToken
    }
  });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    const error = new Error('Email and password are required');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = sanitizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash +refreshTokens');

  if (!user) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  user.refreshTokens.push(hashToken(refreshToken));
  await user.save();

  res.json({
    message: 'Login successful',
    user: user.toPublicJSON(),
    tokens: {
      accessToken,
      refreshToken
    }
  });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    const error = new Error('Refresh token is required');
    error.statusCode = 400;
    throw error;
  }

  let payload;

  try {
    payload = verifyToken(refreshToken);
  } catch (_error) {
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }

  if (payload.type !== 'refresh') {
    const error = new Error('Invalid refresh token type');
    error.statusCode = 401;
    throw error;
  }

  const user = await User.findById(payload.sub).select('+refreshTokens');
  const hashedRefreshToken = hashToken(refreshToken);

  if (!user || !user.refreshTokens.includes(hashedRefreshToken)) {
    const error = new Error('Refresh token not recognized');
    error.statusCode = 401;
    throw error;
  }

  const nextAccessToken = createAccessToken(user);
  const nextRefreshToken = createRefreshToken(user);

  user.refreshTokens = user.refreshTokens
    .filter((token) => token !== hashedRefreshToken)
    .concat(hashToken(nextRefreshToken));

  await user.save();

  res.json({
    message: 'Token refreshed successfully',
    tokens: {
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken
    }
  });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.json({ message: 'Logout successful' });
    return;
  }

  let payload;

  try {
    payload = verifyToken(refreshToken);
  } catch (_error) {
    res.json({ message: 'Logout successful' });
    return;
  }

  const user = await User.findById(payload.sub).select('+refreshTokens');

  if (user) {
    const hashedRefreshToken = hashToken(refreshToken);
    user.refreshTokens = user.refreshTokens.filter((token) => token !== hashedRefreshToken);
    await user.save();
  }

  res.json({ message: 'Logout successful' });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({
    user: req.user.toPublicJSON()
  });
}));

module.exports = router;
