const express = require('express');
const mongoose = require('mongoose');

const authRoutes = require('./auth.routes');
const userRoutes = require('./users.routes');

const router = express.Router();

router.get('/health', (_req, res) => {
  const dbStateLabels = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const dbState = mongoose.connection.readyState;

  res.json({
    status: dbState === 1 ? 'ok' : 'degraded',
    service: 'wealthsphere-backend',
    database: dbStateLabels[dbState] || 'unknown',
    timestamp: new Date().toISOString()
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);

module.exports = router;
