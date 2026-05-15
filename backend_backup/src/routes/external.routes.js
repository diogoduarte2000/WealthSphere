const express = require('express');
const axios = require('axios');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/external/steam/inventory
router.get('/steam/inventory', requireAuth, asyncHandler(async (req, res) => {
  const steamId = req.user.externalApis?.steam?.steamId;

  if (!steamId) {
    const error = new Error('Steam ID not configured');
    error.statusCode = 400;
    throw error;
  }

  try {
    // Usamos um serviço público ou proxy para obter o inventário (AppID 730 = CS2)
    const response = await axios.get(`https://steamcommunity.com/inventory/${steamId}/730/2?l=portuguese&count=5000`);
    
    const inventory = response.data;
    
    // Aqui poderíamos processar os preços se tivéssemos uma API de preços (ex: Skinport ou Steam Price Overview)
    // Por agora retornamos o inventário bruto para o frontend processar ou mostrar
    
    res.json({
      success: true,
      count: inventory.total_inventory_count,
      items: inventory.descriptions.map(item => ({
        name: item.market_name,
        type: item.type,
        icon: `https://community.cloudflare.steamstatic.com/economy/image/${item.icon_url}`,
        rarity: item.tags?.find(t => t.category === 'Rarity')?.localized_tag_name || 'Comum',
        color: item.tags?.find(t => t.category === 'Rarity')?.color || 'ffffff'
      }))
    });
  } catch (error) {
    console.error('Steam API Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter inventário da Steam. Verifica se o perfil é público.',
      error: error.message
    });
  }
}));

module.exports = router;
