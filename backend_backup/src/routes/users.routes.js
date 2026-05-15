const express = require('express');

const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({
    profile: req.user.toPublicJSON()
  });
}));

router.patch('/me/external-apis', requireAuth, asyncHandler(async (req, res) => {
  const { steamId, trading212ApiKey } = req.body;
  const user = req.user;

  if (steamId !== undefined) {
    user.externalApis.steam.steamId = steamId;
  }

  if (trading212ApiKey !== undefined) {
    user.externalApis.trading212.apiKey = trading212ApiKey;
  }

  await user.save();

  res.json({
    message: 'External APIs updated successfully',
    externalApis: {
      steam: user.externalApis.steam
    }
  });
}));

module.exports = router;
