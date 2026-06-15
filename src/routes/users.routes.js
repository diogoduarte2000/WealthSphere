const express = require('express');

const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({
    profile: req.user.toPublicJSON()
  });
}));

module.exports = router;
