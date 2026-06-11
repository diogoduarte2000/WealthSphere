const express = require('express');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const session = require('express-session');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');
const User = require('./models/User');
const Post = require('./models/Post');
const PortfolioSnapshot = require('./models/PortfolioSnapshot');
const bcrypt = require('bcryptjs');

const rootEnvPath = fs.existsSync(path.join(__dirname, '.env'))
  ? path.join(__dirname, '.env')
  : path.join(__dirname, 'backend', '.env');

require('dotenv').config({ path: rootEnvPath });

const app = express();
const PORT = process.env.PORT || 5000;
const steamPriceCache = new Map();
const steamInventoryCache = new Map();
const steamFloatCache = new Map();
const trading212Cache = new Map();
const skinportCache = {
  data: new Map(),
  lastUpdated: 0
};
let skinportUpdatePromise = null;

function setBoundedCache(cache, key, value, maxEntries = 1000) {
  if (!cache.has(key) && cache.size >= maxEntries) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, value);
}

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.set('trust proxy', 1);
app.use(cors({
  origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : 'http://localhost:4200', 
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Session configuration (Required for passport-steam)
app.use(session({
  secret: process.env.SESSION_SECRET || 'wealthsphere-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return '';
  }

  return header.slice(7).trim();
}

function getUserIdFromPayload(payload) {
  return payload?.sub || payload?.id || payload?.userId || null;
}

function toPublicUser(user) {
  if (!user) {
    return null;
  }

  if (typeof user.toPublicJSON === 'function') {
    return user.toPublicJSON();
  }

  return {
    id: user._id,
    steamId: user.steamId,
    steamName: user.steamName,
    steamAvatar: user.steamAvatar,
    displayName: user.displayName || user.name || '',
    name: user.displayName || user.name || '',
    avatar: user.avatar,
    email: user.email,
    inventory: user.inventory,
    financialProfile: user.financialProfile,
    customSettings: user.customSettings,
    realEstate: user.realEstate,
    hasTrading212ApiKey: !!user.trading212ApiKey,
    hasBinanceApiKey: !!user.binanceApiKey,
    hasBinanceApiSecret: !!user.binanceApiSecret,
    hasKrakenApiKey: !!user.krakenApiKey,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseMarketPrice(priceStr) {
  const cleaned = String(priceStr || '').replace(/&nbsp;/g, '').replace(/\s/g, '').replace(/[^\d.,]/g, '');
  if (!cleaned) return null;

  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function generateEstimatedPrice(name) {
  const lowerName = name.toLowerCase();

  // Preços base para diferentes tipos de itens
  const basePrices = {
    'case': 0.5,
    'container': 0.5,
    'sticker': 0.5,
    'graffiti': 0.05,
    'knife': 50,
    'karambit': 150,
    'butterfly': 200,
    'm9 bayonet': 120,
    'bayonet': 80,
    'flip': 60,
    'gut': 40,
    'shadow daggers': 45,
    'falchion': 35,
    'navaja': 30,
    'stiletto': 25,
    'ursus': 40,
    'skeleton': 35,
    'nomad': 30,
    'paracord': 25,
    'survival': 20,
    'glove': 80,
    'sport glove': 100,
    'driver glove': 90,
    'hand wrap': 85,
    'moto glove': 95,
    'specialist glove': 110,
    'glock': 5,
    'usp': 5,
    'p2000': 5,
    'p250': 3,
    'five-seven': 4,
    'tec-9': 3,
    'cz75-auto': 4,
    'deagle': 15,
    'r8': 8,
    'dual berettas': 6,
    'mp9': 4,
    'mac-10': 3,
    'mp7': 5,
    'ump-45': 6,
    'p90': 8,
    'mp5-sd': 7,
    'mag-7': 2,
    'bizon': 3,
    'ak-47': 25,
    'm4a4': 20,
    'm4a1-s': 22,
    'awp': 40,
    'aug': 15,
    'sg 553': 18,
    'famas': 8,
    'galil': 10,
    'nova': 3,
    'xm1014': 4,
    'sawed-off': 2,
    'm249': 10,
    'negev': 8,
  };

  let basePrice = 1;
  for (const [keyword, price] of Object.entries(basePrices)) {
    if (lowerName.includes(keyword)) {
      basePrice = price;
      break;
    }
  }

  const rarityMultipliers = {
    'consumer': 0.5,
    'industrial': 0.7,
    'milspec': 1,
    'restricted': 2,
    'classified': 5,
    'covert': 10,
    'contraband': 50,
  };

  let rarityMultiplier = 1;
  for (const [rarity, multiplier] of Object.entries(rarityMultipliers)) {
    if (lowerName.includes(rarity)) {
      rarityMultiplier = multiplier;
      break;
    }
  }

  const conditionMultipliers = {
    'factory new': 1.5,
    'minimal wear': 1.2,
    'field-tested': 1,
    'well-worn': 0.8,
    'battle-scarred': 0.6,
  };

  let conditionMultiplier = 1;
  for (const [condition, multiplier] of Object.entries(conditionMultipliers)) {
    if (lowerName.includes(condition)) {
      conditionMultiplier = multiplier;
      break;
    }
  }

  let specialMultiplier = 1;
  if (lowerName.includes('stattrak')) specialMultiplier *= 3;
  if (lowerName.includes('souvenir')) specialMultiplier *= 1.5;
  if (lowerName.includes('foil')) specialMultiplier *= 5;
  if (lowerName.includes('holo')) specialMultiplier *= 2;
  if (lowerName.includes('gold')) specialMultiplier *= 2;

  const finalPrice = basePrice * rarityMultiplier * conditionMultiplier * specialMultiplier;
  const variation = 0.9 + Math.random() * 0.2;
  const estimatedPrice = Math.round((finalPrice * variation) * 100) / 100;

  return Math.max(0.01, estimatedPrice);
}

async function updateSkinportCache() {
  if (skinportUpdatePromise) {
    return skinportUpdatePromise;
  }

  skinportUpdatePromise = (async () => {
    try {
      console.log('Updating Skinport price cache...');
      const response = await axios.get('https://api.skinport.com/v1/items', {
        params: {
          app_id: 730,
          currency: 'EUR'
        },
        headers: {
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 30000
      });

      if (Array.isArray(response.data)) {
        const newMap = new Map();
        response.data.forEach(item => {
          newMap.set(item.market_hash_name, item);
        });
        skinportCache.data = newMap;
        skinportCache.lastUpdated = Date.now();
        console.log(`Skinport price cache updated successfully with ${newMap.size} items.`);
        return true;
      }
    } catch (err) {
      console.error('Failed to update Skinport price cache:', err.message);
    } finally {
      skinportUpdatePromise = null;
    }
    return false;
  })();

  return skinportUpdatePromise;
}

async function getSkinportItem(name) {
  const cacheAge = Date.now() - skinportCache.lastUpdated;
  if (skinportCache.data.size === 0 || cacheAge > 12 * 60 * 60 * 1000) {
    if (skinportCache.data.size === 0) {
      await updateSkinportCache();
    } else {
      updateSkinportCache();
    }
  }

  return skinportCache.data.get(name) || null;
}

async function fetchSteamPriceOverview(name, appid = 730) {
  const url = `https://steamcommunity.com/market/priceoverview/`;
  console.log(`Fetching Steam PriceOverview for: ${name} (appid=${appid})`);
  const response = await axios.get(url, {
    params: {
      appid,
      currency: 3,
      market_hash_name: name
    },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://steamcommunity.com/market/'
    },
    timeout: 10000
  });

  if (response.data && response.data.success) {
    const data = response.data;
    const lowest = parseMarketPrice(data.lowest_price);
    const median = parseMarketPrice(data.median_price);
    const finalPrice = lowest ?? median; // lowest_price = "A partir de" no Steam Market

    console.log(`  - Steam PriceOverview [appid=${appid}] ${name}: lowest=${lowest}, median=${median} -> ${finalPrice}`);

    return {
      price: finalPrice,
      change24h: null,
      source: lowest ? 'steam-lowest' : (median ? 'steam-median' : 'steam-success')
    };
  }
  throw new Error('Steam priceoverview success was false');
}

function extractSteamHistory(listingHtml) {
  const matches = [...String(listingHtml).matchAll(/time\\+":(\d+),\\+"price_median\\+":([0-9.]+)/g)];
  return matches
    .map((match) => ({ time: Number(match[1]), price: Number(match[2]) }))
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.price) && point.price > 0);
}

function calculateChange24h(history) {
  if (!Array.isArray(history) || history.length < 2) return null;
  const latest = history[history.length - 1];
  const targetTime = latest.time - 24 * 60 * 60;
  const previous = [...history].reverse().find((point) => point.time <= targetTime) || history[0];
  if (!previous?.price) return null;
  return ((latest.price - previous.price) / previous.price) * 100;
}

async function fetchSteamListingSnapshot(name) {
  const listingUrl = `https://steamcommunity.com/market/listings/730/${encodeURIComponent(name)}`;
  console.log(`Fetching listing for: ${name}`);
  const response = await axios.get(listingUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    responseType: 'text',
    timeout: 10000
  });

  const html = String(response.data || '');
  const saleMatch = html.match(/for sale starting at[\s\S]{0,500}?>([^<>]*\d+[,.]\d+[^<>]*)<\/span>/i);
  const history = extractSteamHistory(html);
  const latestHistoryPrice = history.length ? history[history.length - 1].price : null;

  console.log(`  - saleMatch: ${saleMatch ? 'found' : 'not found'}, history: ${history.length} items, latestPrice: ${latestHistoryPrice}`);

  return {
    price: parseMarketPrice(saleMatch?.[1]) ?? latestHistoryPrice,
    change24h: calculateChange24h(history),
    source: saleMatch ? 'steam-listing' : 'steam-history'
  };
}

function getInspectLink(desc, asset, ownerSteamId) {
  const action = Array.isArray(desc?.actions)
    ? desc.actions.find((candidate) => String(candidate.link || '').includes('csgo_econ_action_preview'))
    : null;
  if (!action?.link) return null;

  return action.link
    .replace('%owner_steamid%', ownerSteamId)
    .replace('%assetid%', asset.assetid)
    .replace('%contextid%', asset.contextid || '2');
}

function getRarity(desc) {
  const rarityTag = Array.isArray(desc?.tags)
    ? desc.tags.find((tag) => tag.category === 'Rarity')
    : null;
  return rarityTag?.localized_tag_name || rarityTag?.internal_name || '';
}

function getRarityRank(desc) {
  const rarityTag = Array.isArray(desc?.tags)
    ? desc.tags.find((tag) => tag.category === 'Rarity')
    : null;
  const internalName = String(rarityTag?.internal_name || '');
  const ranks = [
    ['Contraband', 9],
    ['Ancient', 8],
    ['Legendary', 7],
    ['Mythical', 6],
    ['Rare', 5],
    ['Uncommon', 4],
    ['Common', 3],
    ['Default', 1]
  ];
  return ranks.find(([name]) => internalName.includes(name))?.[1] || 0;
}

function buildTrading212AuthHeaders(user) {
  return { Authorization: user.trading212ApiKey };
}

async function fetchTrading212Resource(baseUrl, pathName, headers) {
  try {
    const response = await axios.get(`${baseUrl}${pathName}`, { headers, timeout: 10000 });
    return response.data;
  } catch (err) {
    if (pathName === '/equity/positions' && err.response && [404, 405].includes(err.response.status)) {
      const response = await axios.get(`${baseUrl}/equity/portfolio`, { headers, timeout: 10000 });
      return response.data;
    }
    if (pathName === '/equity/account/summary' && err.response && [404, 405].includes(err.response.status)) {
      const response = await axios.get(`${baseUrl}/equity/account/cash`, { headers, timeout: 10000 });
      return response.data;
    }
    throw err;
  }
}

function calculateTrading212Total(positions, summary) {
  const explicitTotal = Number(summary?.total ?? summary?.totalValue ?? summary?.portfolioValue ?? summary?.accountValue);
  if (Number.isFinite(explicitTotal) && explicitTotal > 0) {
    return explicitTotal;
  }

  const openPositions = Array.isArray(positions) ? positions : [];
  const positionsTotal = openPositions.reduce((sum, position) => {
    const quantity = Number(position.quantity ?? 0);
    const price = Number(position.currentPrice ?? position.averagePrice ?? 0);
    const value = Number(position.value ?? position.currentValue ?? position.marketValue);
    return sum + (Number.isFinite(value) ? value : quantity * price);
  }, 0);

  const cash = Number(summary?.free ?? summary?.cash ?? summary?.availableCash ?? 0);
  return positionsTotal + (Number.isFinite(cash) ? cash : 0);
}

function createAccessToken(user) {
  return jwt.sign(
    {
      id: String(user._id),
      steamId: user.steamId || undefined
    },
    process.env.JWT_SECRET,
    { subject: String(user._id), expiresIn: '15m' }
  );
}

function createRefreshToken(user) {
  return jwt.sign(
    { type: 'refresh' },
    process.env.JWT_SECRET,
    { subject: String(user._id), expiresIn: '7d' }
  );
}

async function issueTokens(user) {
  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  user.refreshTokens = Array.isArray(user.refreshTokens) ? user.refreshTokens : [];
  user.refreshTokens = [...user.refreshTokens, hashToken(refreshToken)];
  await user.save();

  return { accessToken, refreshToken };
}

async function authenticateRequest(req) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error('No token provided');
    error.statusCode = 401;
    throw error;
  }

  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload.type === 'refresh') {
    const error = new Error('Invalid token type');
    error.statusCode = 401;
    throw error;
  }

  const userId = getUserIdFromPayload(payload);
  if (!userId) {
    const error = new Error('Invalid token payload');
    error.statusCode = 401;
    throw error;
  }

  const user = await User.findById(userId).select('+trading212ApiKey +binanceApiKey +binanceApiSecret +krakenApiKey +krakenApiSecret');
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 401;
    throw error;
  }

  return { user, token, payload };
}

async function removeRefreshToken(user, refreshToken) {
  if (!user || !refreshToken) return;
  user.refreshTokens = Array.isArray(user.refreshTokens) ? user.refreshTokens : [];
  const tokenHash = hashToken(refreshToken);
  user.refreshTokens = user.refreshTokens.filter((value) => value !== tokenHash);
  await user.save();
}

// Steam Strategy
passport.use(new SteamStrategy({
  returnURL: `${process.env.SERVER_URL || 'http://localhost:5000'}/api/auth/steam/return`,
  realm: process.env.SERVER_URL || 'http://localhost:5000',
  apiKey: process.env.STEAM_API_KEY,
  passReqToCallback: true // Permitir acesso ao req para saber se há um utilizador a tentar associar conta
},
  async (req, identifier, profile, done) => {
    try {
      // 1. Verificar se estamos a tentar associar a uma conta existente
      if (req.session.linkUserId) {
        let user = await User.findById(req.session.linkUserId);
        if (user) {
          // Verificar se este SteamID já está em outra conta
          const conflict = await User.findOne({ steamId: profile.id });
          if (conflict && conflict._id.toString() !== user._id.toString()) {
            if (!conflict.email) {
              await User.findByIdAndDelete(conflict._id);
            } else {
              return done(new Error('Este Steam já está associado a outra conta com email.'), null);
            }
          }

          user.steamId = profile.id;
          user.steamName = profile.displayName;
          user.steamAvatar = profile.photos[2].value;
          // NÃO sobrescrevemos o displayName/avatar principal se já existirem
          user.lastLogin = new Date();
          await user.save();
          return done(null, user);
        }
      }

      // 2. Comportamento padrão: Login via Steam (procura ou cria)
      let user = await User.findOne({ steamId: profile.id });
      
      const steamData = {
        steamId: profile.id,
        steamName: profile.displayName,
        steamAvatar: profile.photos[2].value,
        lastLogin: new Date()
      };

      if (!user) {
        // Se for conta nova via Steam, usamos os dados da Steam como principais também
        user = await User.create({
          ...steamData,
          displayName: profile.displayName,
          avatar: profile.photos[2].value
        });
      } else {
        // Atualizar apenas dados Steam
        user = await User.findByIdAndUpdate(user._id, steamData, { new: true });
      }
      
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

// Auth Routes (Login/Register)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ message: 'Nome inválido' });
    }

    if (!email || !String(email).includes('@')) {
      return res.status(400).json({ message: 'Email inválido' });
    }

    if (!password || String(password).length < 8) {
      return res.status(400).json({ message: 'Password demasiado curta' });
    }

    const normalizedEmail = normalizeEmail(email);
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(409).json({ message: 'Email já registado' });

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      displayName: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword
    });

    const { accessToken, refreshToken } = await issueTokens(user);

    res.status(201).json({
      message: 'Utilizador criado com sucesso',
      user: toPublicUser(user),
      tokens: { accessToken, refreshToken }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Erro ao criar conta' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({ email: normalizedEmail }).select('+password +refreshTokens');
    
    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    // Determine stored hash (support legacy passwordHash)
    const storedHash = user.password || user.passwordHash;

    if (!storedHash) {
      console.log('User has no password field (likely Steam-only)');
      return res.status(401).json({ message: 'Esta conta só pode entrar via Steam' });
    }

    // Try bcrypt compare
    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, storedHash);
    } catch (e) {
      isMatch = false;
    }

    // Fallback for plain text passwords (transition period)
    if (!isMatch && password === storedHash) {
      isMatch = true;
    }

    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    // Cleanup: If user had legacy field names, unify them
    if (user.passwordHash || user.name) {
      user.password = await bcrypt.hash(password, 12);
      user.displayName = user.displayName || user.name;
    }

    const { accessToken, refreshToken } = await issueTokens(user);

    res.json({
      message: 'Login efetuado',
      user: toPublicUser(user),
      tokens: { accessToken, refreshToken }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Erro ao entrar' });
  }
});

// Steam Routes
app.get('/api/auth/steam', (req, res, next) => {
  const token = req.query.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.session.linkUserId = decoded.id;
      console.log('--- LINKING FLOW STARTED ---');
      console.log('Token verified. linkUserId set to:', decoded.id);
      
      // Force session save before redirecting to Steam
      return req.session.save((err) => {
        if (err) console.error('Session save error:', err);
        passport.authenticate('steam')(req, res, next);
      });
    } catch (err) {
      console.error('Invalid token for Steam linking:', err.message);
    }
  }
  
  console.log('--- NORMAL LOGIN FLOW ---');
  passport.authenticate('steam')(req, res, next);
});

app.get('/api/auth/steam/return',
  (req, res, next) => {
    const failureUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/auth?error=steam_failed`;
    passport.authenticate('steam', { failureRedirect: failureUrl })(req, res, next);
  },
  async (req, res) => {
    // Limpar o linkUserId da sessão
    const wasLinking = req.session.linkUserId;
    delete req.session.linkUserId;

    const accessToken = createAccessToken(req.user);
    const refreshToken = createRefreshToken(req.user);
    const tokenHash = hashToken(refreshToken);
    req.user.refreshTokens = Array.isArray(req.user.refreshTokens) ? req.user.refreshTokens : [];
    req.user.refreshTokens = [...req.user.refreshTokens, tokenHash];
    req.user.lastLogin = new Date();
    await req.user.save();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const redirectUrl = `${frontendUrl}/auth?token=${accessToken}&refresh=${refreshToken}${wasLinking ? '&linked=true' : ''}`;
    console.log('Steam Auth Success. Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  }
);

// Rota para desassociar conta Steam
app.post('/api/users/unlink-steam', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    user.steamId = undefined;
    user.steamName = undefined;
    user.steamAvatar = undefined;
    await user.save();
    return res.json({ message: 'Steam account unlinked successfully', profile: toPublicUser(user) });
  } catch (err) {
    const statusCode = err.statusCode || 401;
    return res.status(statusCode).json({ message: err.message || 'Invalid token' });
  }
});

app.patch('/api/users/me', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    const { displayName } = req.body;

    if (!displayName || String(displayName).trim().length < 2) {
      return res.status(400).json({ message: 'Display name inválido' });
    }

    user.displayName = String(displayName).trim();
    user.name = String(displayName).trim();
    await user.save();

    return res.json({ message: 'Perfil atualizado', profile: toPublicUser(user) });
  } catch (err) {
    const statusCode = err.statusCode || 401;
    return res.status(statusCode).json({ message: err.message || 'Invalid token' });
  }
});

app.patch('/api/users/me/external-apis', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    const { steamId, trading212ApiKey, binanceApiKey, binanceApiSecret, krakenApiKey, krakenApiSecret, paypalClientId, paypalClientSecret } = req.body;

    if (steamId !== undefined) user.steamId = steamId || undefined;
    if (trading212ApiKey !== undefined) user.trading212ApiKey = trading212ApiKey || undefined;
    if (binanceApiKey !== undefined) user.binanceApiKey = binanceApiKey || undefined;
    if (binanceApiSecret !== undefined) user.binanceApiSecret = binanceApiSecret || undefined;
    if (krakenApiKey !== undefined) user.krakenApiKey = krakenApiKey || undefined;
    if (krakenApiSecret !== undefined) user.krakenApiSecret = krakenApiSecret || undefined;
    if (paypalClientId !== undefined) user.paypalClientId = paypalClientId || undefined;
    if (paypalClientSecret !== undefined) user.paypalClientSecret = paypalClientSecret || undefined;

    user.lastLogin = new Date();
    await user.save();

    return res.json({ message: 'APIs atualizadas', profile: toPublicUser(user) });
  } catch (err) {
    const statusCode = err.statusCode || 401;
    return res.status(statusCode).json({ message: err.message || 'Invalid token' });
  }
});

app.patch('/api/users/me/financial-data', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    const { netWorth, monthlyIncome, monthlyExpenses, etfPortfolio, realEstateValue, cryptoValue } = req.body;

    if (!user.financialProfile) {
      user.financialProfile = { history: [] };
    }

    user.financialProfile = {
      ...user.financialProfile,
      netWorth: netWorth !== undefined ? Number(netWorth) : user.financialProfile.netWorth,
      monthlyIncome: monthlyIncome !== undefined ? Number(monthlyIncome) : user.financialProfile.monthlyIncome,
      monthlyExpenses: monthlyExpenses !== undefined ? Number(monthlyExpenses) : user.financialProfile.monthlyExpenses,
      etfPortfolio: etfPortfolio !== undefined ? Number(etfPortfolio) : user.financialProfile.etfPortfolio,
      realEstateValue: realEstateValue !== undefined ? Number(realEstateValue) : user.financialProfile.realEstateValue,
      cryptoValue: cryptoValue !== undefined ? Number(cryptoValue) : user.financialProfile.cryptoValue
    };

    // Adicionar ao histórico se o netWorth mudou significativamente ou se não houver histórico hoje
    const today = new Date().toISOString().split('T')[0];
    user.financialProfile.history = Array.isArray(user.financialProfile.history) ? user.financialProfile.history : [];
    const lastHistory = user.financialProfile.history[user.financialProfile.history.length - 1];
    const lastDate = lastHistory ? lastHistory.date.toISOString().split('T')[0] : null;

    if (lastDate !== today) {
      user.financialProfile.history.push({
        date: new Date(),
        netWorth: user.financialProfile.netWorth,
        etfPortfolio: user.financialProfile.etfPortfolio,
        realEstateValue: user.financialProfile.realEstateValue
      });
    } else {
      // Atualiza o registo de hoje
      lastHistory.netWorth = user.financialProfile.netWorth;
      lastHistory.etfPortfolio = user.financialProfile.etfPortfolio;
      lastHistory.realEstateValue = user.financialProfile.realEstateValue;
    }

    await user.save();
    res.json({ message: 'Dados financeiros atualizados', profile: toPublicUser(user) });
  } catch (err) {
    console.error('Update financial data error:', err);
    res.status(401).json({ message: 'Invalid token' });
  }
});

app.get('/api/users/me', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    res.json({ profile: toPublicUser(user) });
  } catch (err) {
    const statusCode = err.statusCode || 401;
    res.status(statusCode).json({ message: err.message || 'Invalid token' });
  }
});

app.patch('/api/users/me/settings', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    const { salary, freelance, supermarket, electricity, steamEarnings } = req.body;

    if (!user.customSettings) {
      user.customSettings = {};
    }

    if (salary !== undefined) user.customSettings.salary = Number(salary);
    if (freelance !== undefined) user.customSettings.freelance = Number(freelance);
    if (supermarket !== undefined) user.customSettings.supermarket = Number(supermarket);
    if (electricity !== undefined) user.customSettings.electricity = Number(electricity);
    if (steamEarnings !== undefined) user.customSettings.steamEarnings = Number(steamEarnings);

    await user.save();
    res.json({ message: 'Definições atualizadas', profile: toPublicUser(user) });
  } catch (err) {
    const statusCode = err.statusCode || 401;
    res.status(statusCode).json({ message: err.message || 'Invalid token' });
  }
});

app.post('/api/users/me/real-estate', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    const { action, property, expense, propertyId, expenseId } = req.body;

    if (!user.realEstate) user.realEstate = [];

    if (action === 'addProperty') {
      user.realEstate.push({
        ...property,
        expenses: property?.expenses || []
      });
    } else if (action === 'deleteProperty') {
      user.realEstate = user.realEstate.filter((r) => r._id.toString() !== propertyId);
    } else if (action === 'addExpense') {
      const prop = user.realEstate.find((r) => r._id.toString() === propertyId);
      if (prop) {
        prop.expenses.push({
          type: expense.type,
          amount: Number(expense.amount),
          date: expense.date ? new Date(expense.date) : new Date()
        });
      }
    } else if (action === 'deleteExpense') {
      const prop = user.realEstate.find((r) => r._id.toString() === propertyId);
      if (prop) {
        prop.expenses = prop.expenses.filter((e) => e._id.toString() !== expenseId);
      }
    }

    await user.save();
    res.json({ message: 'Imóveis atualizados', profile: toPublicUser(user) });
  } catch (err) {
    const statusCode = err.statusCode || 401;
    res.status(statusCode).json({ message: err.message || 'Invalid token' });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token is required' });
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (payload.type !== 'refresh') {
      return res.status(401).json({ message: 'Invalid refresh token type' });
    }

    const userId = getUserIdFromPayload(payload);
    const user = await User.findById(userId).select('+refreshTokens');
    const tokenHash = hashToken(refreshToken);

    if (!user || !user.refreshTokens || !user.refreshTokens.includes(tokenHash)) {
      return res.status(401).json({ message: 'Refresh token not recognized' });
    }

    const accessToken = createAccessToken(user);
    const nextRefreshToken = createRefreshToken(user);
    user.refreshTokens = user.refreshTokens.filter((value) => value !== tokenHash);
    user.refreshTokens.push(hashToken(nextRefreshToken));
    await user.save();

    res.json({
      message: 'Token refreshed successfully',
      tokens: {
        accessToken,
        refreshToken: nextRefreshToken
      }
    });
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const { refreshToken } = req.body || {};

  if (!refreshToken) {
    return res.json({ message: 'Logout successful' });
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const userId = getUserIdFromPayload(payload);
    const user = await User.findById(userId).select('+refreshTokens');

    if (user) {
      await removeRefreshToken(user, refreshToken);
    }

    res.json({ message: 'Logout successful' });
  } catch (_err) {
    res.json({ message: 'Logout successful' });
  }
});

app.get('/api/external/steam/price', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ message: 'Missing item name' });

  const cached = steamPriceCache.get(name);
  if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) { // Cache for 1 hour
    return res.json(cached.payload);
  }

  try {
    let payload = null;

    // 1. Try Skinport cache
    const spData = await getSkinportItem(name);
    if (spData) {
      const price = spData.suggested_price ?? spData.min_price ?? spData.median_price ?? spData.mean_price ?? null;
      if (price !== null) {
        payload = {
          price: price,
          change24h: null,
          source: 'skinport'
        };
      }
    }

    // 2. Try Steam PriceOverview
    if (!payload) {
      try {
        payload = await fetchSteamPriceOverview(name);
      } catch (steamErr) {
        console.error(`Steam PriceOverview failed for ${name}:`, steamErr.message);
      }
    }

    // 3. Fallback to estimation
    if (!payload) {
      const estPrice = generateEstimatedPrice(name);
      payload = {
        price: estPrice,
        change24h: null,
        source: 'estimated'
      };
    }

    setBoundedCache(steamPriceCache, name, { payload, timestamp: Date.now() }, 2000);
    return res.json(payload);
  } catch (err) {
    console.error('Steam Price Error for', name, ':', err.message);
    res.json({ price: null, change24h: null, source: 'unavailable' });
  }
});

// Map game IDs (sent by frontend) to Steam appid + contextid
const STEAM_GAMES = {
  cs2:       { appid: 730,     contextid: 2, hasFloat: true  },
  rust:      { appid: 252490,  contextid: 2, hasFloat: false },
  tf2:       { appid: 440,     contextid: 2, hasFloat: false },
  unturned:  { appid: 304930,  contextid: 2, hasFloat: false },
  payday2:   { appid: 218620,  contextid: 2, hasFloat: false },
  banana:    { appid: 2923300, contextid: 2, hasFloat: false },
  kf2:       { appid: 232090,  contextid: 2, hasFloat: false },
  warframe:  { appid: 230410,  contextid: 2, hasFloat: false },
  h1z1:      { appid: 433850,  contextid: 2, hasFloat: false },
  spacewar:  { appid: 480,     contextid: 2, hasFloat: false },
};

app.get('/api/external/steam/inventory', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);

    if (!user || !user.steamId) {
      return res.status(400).json({ message: 'User has no Steam ID linked' });
    }

    // Resolve game — default to cs2
    const gameId = String(req.query.game || 'cs2').toLowerCase();
    const game = STEAM_GAMES[gameId] || STEAM_GAMES.cs2;
    const cacheKey = `${user.steamId}_${gameId}`;
    const force = req.query.force === 'true';

    if (!force) {
      const cached = steamInventoryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 2 * 60 * 1000) {
        return res.json(cached.payload);
      }
    } else {
      steamInventoryCache.delete(cacheKey);
    }

    // Fetch public inventory from Steam Community
    const inventoryUrl = `https://steamcommunity.com/inventory/${user.steamId}/${game.appid}/${game.contextid}?l=english&count=2000`;
    const response = await axios.get(inventoryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    const descriptions = Array.isArray(response.data?.descriptions) ? response.data.descriptions : [];
    const assets = Array.isArray(response.data?.assets) ? response.data.assets : [];
    const descriptionsByAsset = new Map(descriptions.map((desc) => [`${desc.classid}_${desc.instanceid}`, desc]));

    // Build individual items (not grouped) so each has its own inspectLink for float
    const items = assets.map((asset) => {
      const desc = descriptionsByAsset.get(`${asset.classid}_${asset.instanceid}`) || {};
      return {
        assetId: asset.assetid,
        name: desc.market_hash_name,
        icon: desc.icon_url ? `https://community.cloudflare.steamstatic.com/economy/image/${desc.icon_url}` : '',
        color: desc.name_color || 'ffffff',
        type: desc.type || 'Item',
        rarity: getRarity(desc),
        rarityRank: getRarityRank(desc),
        tradable: desc.tradable,
        marketable: desc.marketable,
        inspectLink: game.hasFloat ? getInspectLink(desc, asset, user.steamId) : null,
        float: null,
        paintSeed: null,
        paintIndex: null,
        change24h: null,
        price: null,
        priceSource: null
      };
    }).filter((item) => item.name);

    // --- PRICES: one request per unique item name ---
    const priceByName = new Map();
    const uniqueNames = [...new Set(items.filter(i => i.marketable).map(i => i.name))];
    console.log(`[${gameId}] Fetching Steam Market prices for ${uniqueNames.length} unique items...`);

    // Skinport só para CS2
    if (game.appid === 730) {
      const spAge = Date.now() - skinportCache.lastUpdated;
      if (skinportCache.data.size === 0 || spAge > 12 * 60 * 60 * 1000) {
        await updateSkinportCache();
      }
    }

    for (const name of uniqueNames) {
      try {
        let priceData = null;

        // 1. Steam Market PriceOverview (primary — preço real "A partir de")
        try {
          priceData = await fetchSteamPriceOverview(name, game.appid);
          await new Promise(resolve => setTimeout(resolve, 800));
        } catch (steamErr) {
          console.error(`✗ Steam PriceOverview failed for ${name}:`, steamErr.message);
        }

        // 2. Skinport fallback — apenas CS2
        if (!priceData && game.appid === 730) {
          const spData = skinportCache.data.get(name);
          if (spData) {
            const price = spData.suggested_price ?? spData.min_price ?? spData.median_price ?? spData.mean_price ?? null;
            if (price !== null) priceData = { price, change24h: null, source: 'skinport' };
          }
        }

        // 3. Local estimate fallback
        if (!priceData) {
          priceData = { price: generateEstimatedPrice(name), change24h: null, source: 'estimated' };
        }

        priceByName.set(name, priceData);
        console.log(`✓ Price [${priceData.source}] ${name}: €${priceData.price}`);
      } catch (err) {
        console.error(`✗ Price error for ${name}:`, err.message);
        priceByName.set(name, { price: null, change24h: null, source: 'error' });
      }
    }

    // --- FLOATS: only for CS2 weapons (skip stickers, graffiti, badges, music kits) ---
    const FLOAT_SKIP_PREFIXES = ['Sticker |', 'Sealed Graffiti |', 'Music Kit |', 'Global Offensive Badge'];
    const itemsWithInspect = game.hasFloat
      ? items.filter(i => i.inspectLink && !FLOAT_SKIP_PREFIXES.some(p => i.name.startsWith(p))).slice(0, 60)
      : [];
    console.log(`[${gameId}] Fetching floats for ${itemsWithInspect.length} items via CSFloat...`);

    async function fetchFloatCached(item) {
      const cacheKey = hashToken(String(item.inspectLink));
      const hit = steamFloatCache.get(cacheKey);
      if (hit && Date.now() - hit.timestamp < 24 * 60 * 60 * 1000) {
        return { assetId: item.assetId, ...hit.payload };
      }
      try {
        const fr = await axios.get('https://api.csfloat.com/', {
          params: { url: item.inspectLink },
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 10000
        });
        const info = fr.data?.iteminfo || fr.data;
        const payload = {
          float: typeof info?.floatvalue === 'number' ? info.floatvalue : null,
          paintSeed: info?.paintseed ?? null,
          paintIndex: info?.paintindex ?? null
        };
        setBoundedCache(steamFloatCache, cacheKey, { payload, timestamp: Date.now() }, 5000);
        return { assetId: item.assetId, ...payload };
      } catch (err) {
        console.error(`Float error for ${item.name} (${item.assetId}):`, err.message);
        return { assetId: item.assetId, float: null, paintSeed: null, paintIndex: null };
      }
    }

    const floatByAssetId = new Map();
    const FLOAT_CONCURRENCY = 3;
    for (let i = 0; i < itemsWithInspect.length; i += FLOAT_CONCURRENCY) {
      const batch = itemsWithInspect.slice(i, i + FLOAT_CONCURRENCY);
      const results = await Promise.all(batch.map(item => fetchFloatCached(item)));
      results.forEach(r => floatByAssetId.set(r.assetId, r));
    }
    console.log(`[${gameId}] Float fetch complete: ${floatByAssetId.size} items`);

    // --- MERGE prices + floats into final individual items ---
    const finalItems = items.map(item => {
      const pd = item.marketable ? (priceByName.get(item.name) || { price: null, change24h: null, source: null }) : { price: null, change24h: null, source: null };
      const fd = floatByAssetId.get(item.assetId) || {};
      return {
        ...item,
        price: pd.price,
        change24h: pd.change24h,
        priceSource: pd.source,
        float: fd.float ?? null,
        paintSeed: fd.paintSeed ?? null,
        paintIndex: fd.paintIndex ?? null
      };
    });

    const payload = {
      game: gameId,
      appid: game.appid,
      count: response.data.total_inventory_count || items.length,
      items: finalItems.slice(0, 200)
    };

    setBoundedCache(steamInventoryCache, cacheKey, {
      timestamp: Date.now(),
      payload
    }, 500);

    res.json(payload);
  } catch (err) {
    console.error('Steam Inventory Error:', err.message);
    res.status(500).json({ message: 'Failed to fetch Steam inventory' });
  }
});

app.get('/api/external/steam/inventory-test', async (req, res) => {
  try {
    const steamId = req.query.steamId || '76561198020822606';
    const inventoryUrl = `https://steamcommunity.com/inventory/${steamId}/730/2?l=portuguese&count=2000`;
    const response = await axios.get(inventoryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    const descriptions = Array.isArray(response.data?.descriptions) ? response.data.descriptions : [];
    const assets = Array.isArray(response.data?.assets) ? response.data.assets : [];
    const descriptionsByAsset = new Map(descriptions.map((desc) => [`${desc.classid}_${desc.instanceid}`, desc]));
    const items = assets.map((asset) => {
      const desc = descriptionsByAsset.get(`${asset.classid}_${asset.instanceid}`) || {};
      return {
        assetId: asset.assetid,
        name: desc.market_hash_name,
        icon: desc.icon_url ? `https://community.cloudflare.steamstatic.com/economy/image/${desc.icon_url}` : '',
        color: desc.name_color || 'ffffff',
        type: desc.type || 'Item',
        rarity: getRarity(desc),
        rarityRank: getRarityRank(desc),
        tradable: desc.tradable,
        inspectLink: getInspectLink(desc, asset, steamId)
      };
    }).filter((item) => item.name);

    res.json({
      count: response.data.total_inventory_count || items.length,
      items: items.slice(0, 100)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/debug/users', async (req, res) => {
  try {
    const users = await User.find({}, 'name email steamId steamName');
    res.json(users);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/external/steam/float', async (req, res) => {
  const { inspectLink } = req.query;
  if (!inspectLink) return res.status(400).json({ message: 'Missing inspect link' });

  const cacheKey = hashToken(String(inspectLink));
  const cached = steamFloatCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
    return res.json(cached.payload);
  }

  try {
    const response = await axios.get('https://api.csfloat.com/', {
      params: { url: inspectLink },
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    const itemInfo = response.data?.iteminfo || response.data;
    const payload = {
      float: typeof itemInfo?.floatvalue === 'number' ? itemInfo.floatvalue : null,
      paintSeed: itemInfo?.paintseed ?? null,
      paintIndex: itemInfo?.paintindex ?? null,
      source: 'csfloat'
    };

    setBoundedCache(steamFloatCache, cacheKey, { payload, timestamp: Date.now() }, 5000);
    res.json(payload);
  } catch (err) {
    console.error('Steam Float Error:', err.response?.data || err.message);
    res.json({ float: null, paintSeed: null, paintIndex: null, source: 'unavailable' });
  }
});

app.get('/api/external/trading212/portfolio', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);

    if (!user || !user.trading212ApiKey) {
      return res.status(400).json({ message: 'User has no Trading 212 API Key linked' });
    }

    const cached = trading212Cache.get(String(user._id));
    if (cached && Date.now() - cached.timestamp < 60 * 1000) {
      return res.json(cached.payload);
    }

    const headers = buildTrading212AuthHeaders(user);
    let data = null;
    let environmentName = 'live';

    try {
      const baseUrl = 'https://live.trading212.com/api/v0';
      const positions = await fetchTrading212Resource(baseUrl, '/equity/positions', headers);
      const summary = await fetchTrading212Resource(baseUrl, '/equity/account/summary', headers);
      data = { positions, summary };
    } catch (liveErr) {
      if (liveErr.response && (liveErr.response.status === 401 || liveErr.response.status === 403)) {
        const baseUrl = 'https://demo.trading212.com/api/v0';
        const positions = await fetchTrading212Resource(baseUrl, '/equity/positions', headers);
        const summary = await fetchTrading212Resource(baseUrl, '/equity/account/summary', headers);
        data = { positions, summary };
        environmentName = 'demo';
      } else {
        throw liveErr;
      }
    }

    if (!data) {
      return res.json({ success: false });
    }

    const total = calculateTrading212Total(data.positions, data.summary);
    const invested = Number(data.summary?.investedValue ?? data.summary?.invested ?? 0);
    const result = Number(data.summary?.ppl ?? data.summary?.result ?? (total - invested));

    const payload = {
      success: true,
      data: {
        environment: environmentName,
        total,
        invested,
        result,
        positions: Array.isArray(data.positions) ? data.positions : [],
        summary: data.summary
      }
    };

    setBoundedCache(trading212Cache, String(user._id), {
      timestamp: Date.now(),
      payload
    }, 500);

    // Save daily portfolio snapshot for evolution chart
    try {
      const today = new Date().toISOString().slice(0, 10);
      const total = payload.data?.total || 0;
      const invested = data.summary?.investedValue ?? data.summary?.invested ?? 0;
      await PortfolioSnapshot.findOneAndUpdate(
        { user: user._id, date: today, source: 'trading212' },
        { total, invested, result: total - invested },
        { upsert: true, new: true }
      );
    } catch (snapErr) { /* non-critical */ }

    res.json(payload);
  } catch (err) {
    console.error('Trading 212 API Error:', err.response?.data || err.message);
    res.status(500).json({ message: 'Failed to fetch Trading 212 data' });
  }
});

// Portfolio evolution history
app.get('/api/external/trading212/history', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    const days = parseInt(req.query.days) || 90;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().slice(0, 10);

    const snapshots = await PortfolioSnapshot.find({
      user: user._id,
      source: 'trading212',
      date: { $gte: sinceStr }
    }).sort({ date: 1 }).lean();

    res.json({ snapshots });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter histórico' });
  }
});

// ==========================================
//           MARKET DATA API (public)
// ==========================================
let marketDataCache = null;
let marketDataCacheTime = 0;
const MARKET_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

app.get('/api/external/market-data', async (req, res) => {
  try {
    if (marketDataCache && Date.now() - marketDataCacheTime < MARKET_CACHE_TTL) {
      return res.json(marketDataCache);
    }

    const results = {};

    // Crypto: CoinGecko (free, no key needed)
    try {
      const cgResp = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=eur&include_24hr_change=true',
        { timeout: 8000 }
      );
      results.bitcoin = { price: cgResp.data.bitcoin?.eur, change24h: cgResp.data.bitcoin?.eur_24h_change };
      results.ethereum = { price: cgResp.data.ethereum?.eur, change24h: cgResp.data.ethereum?.eur_24h_change };
    } catch (e) { console.warn('CoinGecko error:', e.message); }

    // Forex EUR/USD and EUR/GBP: ECB free API
    try {
      const ecbResp = await axios.get(
        'https://api.frankfurter.app/latest?from=EUR&to=USD,GBP',
        { timeout: 8000 }
      );
      results.eurUsd = ecbResp.data.rates?.USD;
      results.eurGbp = ecbResp.data.rates?.GBP;
    } catch (e) { console.warn('Frankfurter forex error:', e.message); }

    // Euribor: ECB SDMX API (flow/key format)
    try {
      const euriborSeries = [
        { key: 'euribor3m',  seriesKey: 'M.U2.EUR.RT0.MM.EURIBOR3MD_.HSTA' },
        { key: 'euribor6m',  seriesKey: 'M.U2.EUR.RT0.MM.EURIBOR6MD_.HSTA' },
        { key: 'euribor12m', seriesKey: 'M.U2.EUR.RT0.MM.EURIBOR1YD_.HSTA' },
      ];
      for (const { key, seriesKey } of euriborSeries) {
        try {
          const r = await axios.get(
            `https://data-api.ecb.europa.eu/service/data/FM/${seriesKey}?lastNObservations=1&format=jsondata`,
            { timeout: 10000, headers: { 'Accept': 'application/json' } }
          );
          const seriesData = r.data?.dataSets?.[0]?.series;
          if (seriesData) {
            const firstKey = Object.keys(seriesData)[0];
            const obs = seriesData[firstKey]?.observations;
            if (obs) {
              const lastObs = Object.values(obs).pop();
              results[key] = Array.isArray(lastObs) ? lastObs[0] : lastObs;
            }
          }
        } catch (e) { console.warn(`ECB ${key} error:`, e.message); }
      }
    } catch (e) { console.warn('ECB Euribor error:', e.message); }

    results.updatedAt = new Date().toISOString();

    marketDataCache = results;
    marketDataCacheTime = Date.now();

    res.json(results);
  } catch (err) {
    console.error('Market data error:', err.message);
    res.status(500).json({ message: 'Erro ao obter dados de mercado' });
  }
});

// ==========================================
//              BINANCE API
// ==========================================
const binanceBalanceCache = new Map();

app.get('/api/external/binance/balance', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    if (!user.binanceApiKey || !user.binanceApiSecret) {
      return res.status(400).json({ message: 'Binance API Key e Secret não configurados' });
    }

    const cached = binanceBalanceCache.get(String(user._id));
    if (cached && Date.now() - cached.timestamp < 60_000) {
      return res.json(cached.payload);
    }

    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto
      .createHmac('sha256', user.binanceApiSecret)
      .update(queryString)
      .digest('hex');

    const response = await axios.get(
      `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
      { headers: { 'X-MBX-APIKEY': user.binanceApiKey }, timeout: 10000 }
    );

    const balances = response.data.balances
      .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map(b => ({ asset: b.asset, free: parseFloat(b.free), locked: parseFloat(b.locked), total: parseFloat(b.free) + parseFloat(b.locked) }));

    const payload = { success: true, balances };
    setBoundedCache(binanceBalanceCache, String(user._id), { timestamp: Date.now(), payload }, 500);
    res.json(payload);
  } catch (err) {
    const msg = err.response?.data?.msg || err.message;
    console.error('Binance API Error:', msg);
    res.status(500).json({ message: `Erro Binance: ${msg}` });
  }
});

// ==========================================
//              KRAKEN API
// ==========================================
const krakenBalanceCache = new Map();

function buildKrakenSignature(path, nonce, postData, secret) {
  const message = postData + crypto.createHash('sha256').update(nonce + postData).digest('binary');
  const secretBuffer = Buffer.from(secret, 'base64');
  return crypto.createHmac('sha512', secretBuffer).update(path + message, 'binary').digest('base64');
}

app.get('/api/external/kraken/balance', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    if (!user.krakenApiKey || !user.krakenApiSecret) {
      return res.status(400).json({ message: 'Kraken API Key e Secret não configurados' });
    }

    const cached = krakenBalanceCache.get(String(user._id));
    if (cached && Date.now() - cached.timestamp < 60_000) {
      return res.json(cached.payload);
    }

    const nonce = String(Date.now() * 1000);
    const postData = `nonce=${nonce}`;
    const path = '/0/private/Balance';
    const signature = buildKrakenSignature(path, nonce, postData, user.krakenApiSecret);

    const response = await axios.post(
      `https://api.kraken.com${path}`,
      postData,
      {
        headers: {
          'API-Key': user.krakenApiKey,
          'API-Sign': signature,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    );

    if (response.data.error && response.data.error.length > 0) {
      return res.status(400).json({ message: response.data.error.join(', ') });
    }

    const balances = Object.entries(response.data.result || {})
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([asset, amount]) => ({ asset, total: parseFloat(amount) }));

    const payload = { success: true, balances };
    setBoundedCache(krakenBalanceCache, String(user._id), { timestamp: Date.now(), payload }, 500);
    res.json(payload);
  } catch (err) {
    const msg = err.response?.data?.error?.[0] || err.message;
    console.error('Kraken API Error:', msg);
    res.status(500).json({ message: `Erro Kraken: ${msg}` });
  }
});

// ==========================================
//              PAYPAL API
// ==========================================

const paypalBalanceCache = new Map();

app.get('/api/external/paypal/balance', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    if (!user.paypalClientId || !user.paypalClientSecret) {
      return res.status(400).json({ message: 'PayPal Client ID e Secret não configurados' });
    }

    const cached = paypalBalanceCache.get(String(user._id));
    if (cached && Date.now() - cached.timestamp < 60_000) {
      return res.json(cached.payload);
    }

    // Get OAuth token
    const tokenRes = await axios.post(
      'https://api-m.sandbox.paypal.com/v1/oauth2/token',
      'grant_type=client_credentials',
      {
        auth: { username: user.paypalClientId, password: user.paypalClientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000
      }
    );
    const accessToken = tokenRes.data.access_token;

    // Get account balances
    const balRes = await axios.get(
      'https://api-m.sandbox.paypal.com/v1/reporting/balances',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { currency_code: 'EUR', as_of_time: new Date().toISOString() },
        timeout: 10000
      }
    );

    const balances = (balRes.data.balances || []).map(b => ({
      currency: b.currency,
      available: parseFloat(b.available_balance?.value || 0),
      total: parseFloat(b.total_balance?.value || 0)
    }));

    const payload = { success: true, balances };
    setBoundedCache(paypalBalanceCache, String(user._id), { timestamp: Date.now(), payload }, 500);
    res.json(payload);
  } catch (err) {
    const msg = err.response?.data?.message || err.response?.data?.error_description || err.message;
    console.error('PayPal API Error:', msg);
    res.status(500).json({ message: `Erro PayPal: ${msg}` });
  }
});

// ==========================================
//                 FORUM API
// ==========================================

// GET all posts with filters and sorting
app.get('/api/forum', async (req, res) => {
  try {
    const { search, category, tag, sort } = req.query;
    let query = {};

    if (category && category !== 'Todas' && category !== 'all') {
      // Handle different casing/naming from frontend
      // Tags/categorias navegáveis: ETF, Imóveis, CS2, FIRE, Portugal, Novato
      let mappedCategory = category;
      if (category.toLowerCase().includes('etf')) mappedCategory = 'ETF & Ações';
      else if (category.toLowerCase().includes('imoveis') || category.toLowerCase().includes('imóveis')) mappedCategory = 'Imóveis & Rendas';
      else if (category.toLowerCase().includes('cs2') || category.toLowerCase().includes('steam')) mappedCategory = 'CS2 & Steam';
      else if (category.toLowerCase().includes('fire') || category.toLowerCase().includes('poupança')) mappedCategory = 'FIRE & Poupança';
      else if (category.toLowerCase().includes('cripto')) mappedCategory = 'Cripto';
      else if (category.toLowerCase().includes('portugal') || category.toLowerCase().includes('irs')) mappedCategory = 'Portugal & IRS';
      else if (category.toLowerCase().includes('novato')) mappedCategory = 'Novato';
      
      query.category = mappedCategory;
    }

    if (tag) {
      query.tags = tag.startsWith('#') ? tag : `#${tag}`;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    let sortQuery = { isPinned: -1, createdAt: -1 }; // Pinned always first

    if (sort === 'trending') {
      sortQuery = { isPinned: -1, votes: -1, 'comments.length': -1, createdAt: -1 };
    } else if (sort === 'top') {
      sortQuery = { isPinned: -1, votes: -1 };
    } else if (sort === 'unanswered') {
      query.comments = { $size: 0 };
      sortQuery = { isPinned: -1, createdAt: -1 };
    } else if (sort === 'recent') {
      sortQuery = { isPinned: -1, createdAt: -1 };
    }

    // Increments views on get (standard fetch doesn't view-increment, but for simplicity we can increment viewed inline)
    const posts = await Post.find(query).sort(sortQuery);
    res.json(posts);
  } catch (err) {
    console.error('Get posts error:', err);
    res.status(500).json({ message: 'Erro ao carregar posts' });
  }
});

// GET specific post and increment views
app.get('/api/forum/:id', async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true });
    if (!post) return res.status(404).json({ message: 'Post não encontrado' });
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao carregar post' });
  }
});

// POST new post
app.post('/api/forum', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    const { title, content, category, tags } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Título e conteúdo são obrigatórios' });
    }

    let tagsArray = Array.isArray(tags) ? tags : [];
    // Ensure all tags start with #
    tagsArray = tagsArray.map(t => t.startsWith('#') ? t : `#${t}`);
    
    // REQUIREMENT: Must have #investimentos tag!
    if (!tagsArray.some(t => t.toLowerCase() === '#investimentos')) {
      tagsArray.push('#investimentos');
    }

    // Determine user flair based on user's investments or realEstate
    let flair = 'Membro';
    if (user.realEstate && user.realEstate.length > 0) flair = 'Landlord';
    else if (user.financialProfile && user.financialProfile.etfPortfolio > 1000) flair = 'Expert ETFs';
    else if (user.inventory && user.inventory.length > 5) flair = 'Skin Trader';
    else if (user.customSettings && user.customSettings.salary > 3000) flair = 'FIRE';

    const post = await Post.create({
      author: user._id,
      authorName: user.displayName || user.name || 'Utilizador',
      authorAvatar: user.avatar || user.steamAvatar || '',
      authorFlair: flair,
      title,
      content,
      category: category || 'Novato',
      tags: tagsArray,
      votes: 0,
      views: 1
    });

    res.status(201).json(post);
  } catch (err) {
    console.error('Create post error:', err);
    res.status(err.statusCode || 500).json({ message: err.message || 'Erro ao publicar post' });
  }
});

// DELETE post
app.delete('/api/forum/:id', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post não encontrado' });

    if (post.author.toString() !== user._id.toString()) {
      return res.status(403).json({ message: 'Não tens permissão para apagar este post' });
    }

    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post removido com sucesso' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || 'Erro ao remover post' });
  }
});

// VOTE on a post
app.post('/api/forum/:id/vote', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    const { direction } = req.body; // 'up' or 'down'
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post não encontrado' });

    const userIdStr = user._id.toString();
    const hasUpvoted = post.upvotedBy.some(id => id.toString() === userIdStr);
    const hasDownvoted = post.downvotedBy.some(id => id.toString() === userIdStr);

    if (direction === 'up') {
      if (hasUpvoted) {
        // Toggle off upvote
        post.upvotedBy = post.upvotedBy.filter(id => id.toString() !== userIdStr);
      } else {
        // Toggle on upvote, remove downvote if any
        post.upvotedBy.push(user._id);
        post.downvotedBy = post.downvotedBy.filter(id => id.toString() !== userIdStr);
      }
    } else if (direction === 'down') {
      if (hasDownvoted) {
        // Toggle off downvote
        post.downvotedBy = post.downvotedBy.filter(id => id.toString() !== userIdStr);
      } else {
        // Toggle on downvote, remove upvote if any
        post.downvotedBy.push(user._id);
        post.upvotedBy = post.upvotedBy.filter(id => id.toString() !== userIdStr);
      }
    }

    post.votes = post.upvotedBy.length - post.downvotedBy.length;
    await post.save();
    res.json({ votes: post.votes, upvoted: post.upvotedBy.includes(user._id), downvoted: post.downvotedBy.includes(user._id) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || 'Erro ao votar' });
  }
});

// POST comment to a post
app.post('/api/forum/:id/comments', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: 'Conteúdo do comentário é obrigatório' });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post não encontrado' });

    post.comments.push({
      author: user._id,
      authorName: user.displayName || user.name || 'Utilizador',
      authorAvatar: user.avatar || user.steamAvatar || '',
      content,
      votes: 0,
      replies: []
    });

    await post.save();
    res.json(post);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || 'Erro ao adicionar comentário' });
  }
});

// POST reply to a comment (1-level nesting)
app.post('/api/forum/:id/comments/:commentId/reply', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: 'Conteúdo da resposta é obrigatório' });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post não encontrado' });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comentário não encontrado' });

    comment.replies.push({
      author: user._id,
      authorName: user.displayName || user.name || 'Utilizador',
      authorAvatar: user.avatar || user.steamAvatar || '',
      content,
      votes: 0
    });

    await post.save();
    res.json(post);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || 'Erro ao responder' });
  }
});

// VOTE on a comment
app.post('/api/forum/comments/:commentId/vote', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    const { direction } = req.body;
    
    // Find post containing the comment
    const post = await Post.findOne({ 'comments._id': req.params.commentId });
    if (!post) return res.status(404).json({ message: 'Comentário não encontrado' });

    const comment = post.comments.id(req.params.commentId);
    const userIdStr = user._id.toString();
    const hasUpvoted = comment.upvotedBy.some(id => id.toString() === userIdStr);
    const hasDownvoted = comment.downvotedBy.some(id => id.toString() === userIdStr);

    if (direction === 'up') {
      if (hasUpvoted) {
        comment.upvotedBy = comment.upvotedBy.filter(id => id.toString() !== userIdStr);
      } else {
        comment.upvotedBy.push(user._id);
        comment.downvotedBy = comment.downvotedBy.filter(id => id.toString() !== userIdStr);
      }
    } else if (direction === 'down') {
      if (hasDownvoted) {
        comment.downvotedBy = comment.downvotedBy.filter(id => id.toString() !== userIdStr);
      } else {
        comment.downvotedBy.push(user._id);
        comment.upvotedBy = comment.upvotedBy.filter(id => id.toString() !== userIdStr);
      }
    }

    comment.votes = comment.upvotedBy.length - comment.downvotedBy.length;
    await post.save();
    res.json({ votes: comment.votes });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || 'Erro ao votar no comentário' });
  }
});

// ==========================================
//           STOCKS API (Yahoo Finance)
// ==========================================
let yahooFinance;
try { yahooFinance = require('yahoo-finance2').default; } catch(e) { console.warn('yahoo-finance2 not available'); }

const stockSearchCache = new Map();
const stockQuoteCache  = new Map();
const stockChartCache  = new Map();
const STOCK_SEARCH_TTL = 5 * 60 * 1000;   // 5 min
const STOCK_QUOTE_TTL  = 2 * 60 * 1000;   // 2 min
const STOCK_CHART_TTL  = 10 * 60 * 1000;  // 10 min

app.get('/api/external/stocks/search', async (req, res) => {
  if (!yahooFinance) return res.status(503).json({ message: 'Yahoo Finance unavailable' });
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const cacheKey = q.toLowerCase();
  const cached = stockSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < STOCK_SEARCH_TTL) return res.json(cached.data);
  try {
    const result = await yahooFinance.search(q, { newsCount: 0, quotesCount: 10 });
    const quotes = (result.quotes || [])
      .filter(r => r.quoteType === 'EQUITY' || r.quoteType === 'ETF' || r.quoteType === 'MUTUALFUND' || r.quoteType === 'INDEX')
      .slice(0, 10)
      .map(r => ({
        symbol: r.symbol,
        shortname: r.shortname || r.longname || r.symbol,
        longname: r.longname || r.shortname || r.symbol,
        exchange: r.exchange,
        quoteType: r.quoteType,
        typeDisp: r.typeDisp,
        score: r.score
      }));
    setBoundedCache(stockSearchCache, cacheKey, { ts: Date.now(), data: quotes }, 200);
    res.json(quotes);
  } catch (err) {
    console.error('Stock search error:', err.message);
    res.status(500).json({ message: 'Erro ao pesquisar ações' });
  }
});

// Trending / category stocks
const TRENDING_CATEGORIES = {
  tendencias: ['NVDA','AAPL','MSFT','AMZN','TSLA','META','GOOGL','AMD','NFLX','PLTR'],
  bigtech:    ['AAPL','MSFT','GOOGL','META','AMZN','NVDA','TSLA','ORCL','CRM','ADBE'],
  etfs:       ['SPY','VOO','QQQ','VTI','VWRA.L','CSPX.L','IWDA.AS','VUSA.L','EQQQ.L','XDWD.DE'],
  cripto:     ['BTC-USD','ETH-USD','BNB-USD','SOL-USD','XRP-USD','ADA-USD','DOGE-USD','AVAX-USD'],
  dividendos: ['JNJ','KO','PG','VZ','T','MMM','MO','O','REALTY','HDV'],
};
const trendingCache = new Map();
const TRENDING_TTL = 5 * 60 * 1000;

app.get('/api/external/stocks/trending', async (req, res) => {
  if (!yahooFinance) return res.status(503).json({ message: 'Yahoo Finance unavailable' });
  const cat = (req.query.cat || 'tendencias').toLowerCase();
  const symbols = TRENDING_CATEGORIES[cat] || TRENDING_CATEGORIES.tendencias;
  const cacheKey = cat;
  const cached = trendingCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TRENDING_TTL) return res.json(cached.data);
  try {
    const results = await Promise.allSettled(
      symbols.map(s => yahooFinance.quote(s, { fields: ['symbol','shortName','regularMarketPrice','regularMarketChangePercent','regularMarketChange','currency','quoteType','exchange'] }).catch(() => null))
    );
    const data = results
      .map(r => r.status === 'fulfilled' ? r.value : null)
      .filter(Boolean)
      .map(q => ({
        symbol: q.symbol,
        shortName: q.shortName || q.symbol,
        price: q.regularMarketPrice,
        change: q.regularMarketChange,
        changePct: q.regularMarketChangePercent,
        currency: q.currency || 'USD',
        quoteType: q.quoteType,
        exchange: q.exchange,
      }));
    setBoundedCache(trendingCache, cacheKey, { ts: Date.now(), data }, 20);
    res.json(data);
  } catch (err) {
    console.error('Trending stocks error:', err.message);
    res.status(500).json({ message: 'Erro ao carregar tendências' });
  }
});

app.get('/api/external/stocks/quote', async (req, res) => {
  if (!yahooFinance) return res.status(503).json({ message: 'Yahoo Finance unavailable' });
  const symbol = (req.query.symbol || '').trim().toUpperCase();
  if (!symbol) return res.status(400).json({ message: 'Symbol required' });
  const cached = stockQuoteCache.get(symbol);
  if (cached && Date.now() - cached.ts < STOCK_QUOTE_TTL) return res.json(cached.data);
  try {
    const q = await yahooFinance.quote(symbol);
    const data = {
      symbol: q.symbol,
      shortName: q.shortName || q.longName || symbol,
      longName: q.longName || q.shortName || symbol,
      currency: q.currency,
      regularMarketPrice: q.regularMarketPrice,
      regularMarketChange: q.regularMarketChange,
      regularMarketChangePercent: q.regularMarketChangePercent,
      regularMarketPreviousClose: q.regularMarketPreviousClose,
      regularMarketOpen: q.regularMarketOpen,
      regularMarketDayHigh: q.regularMarketDayHigh,
      regularMarketDayLow: q.regularMarketDayLow,
      regularMarketVolume: q.regularMarketVolume,
      fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: q.fiftyTwoWeekLow,
      marketCap: q.marketCap,
      trailingPE: q.trailingPE,
      forwardPE: q.forwardPE,
      dividendYield: q.dividendYield,
      fiftyDayAverage: q.fiftyDayAverage,
      twoHundredDayAverage: q.twoHundredDayAverage,
      exchange: q.exchange,
      quoteType: q.quoteType,
      sector: q.sector,
      industry: q.industry,
      marketState: q.marketState
    };
    setBoundedCache(stockQuoteCache, symbol, { ts: Date.now(), data }, 500);
    res.json(data);
  } catch (err) {
    console.error('Stock quote error:', err.message);
    res.status(500).json({ message: `Erro ao obter cotação: ${err.message}` });
  }
});

const PERIOD_MAP = { '1d': 1, '5d': 5, '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365, '2y': 730, '5y': 1825 };
const INTERVAL_MAP = { '1d': '5m', '5d': '30m', '1mo': '1d', '3mo': '1d', '6mo': '1wk', '1y': '1wk', '2y': '1wk', '5y': '1mo' };

app.get('/api/external/stocks/chart', async (req, res) => {
  if (!yahooFinance) return res.status(503).json({ message: 'Yahoo Finance unavailable' });
  const symbol = (req.query.symbol || '').trim().toUpperCase();
  const period = req.query.period || '1mo';
  if (!symbol) return res.status(400).json({ message: 'Symbol required' });
  const cacheKey = `${symbol}_${period}`;
  const cached = stockChartCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < STOCK_CHART_TTL) return res.json(cached.data);
  try {
    const days = PERIOD_MAP[period] || 30;
    const interval = INTERVAL_MAP[period] || '1d';
    const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const chart = await yahooFinance.chart(symbol, { period1, interval });
    const quotes = (chart.quotes || []).filter(q => q.close != null).map(q => ({
      date: q.date instanceof Date ? q.date.toISOString() : q.date,
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.volume
    }));
    const data = {
      symbol,
      currency: chart.meta?.currency,
      regularMarketPrice: chart.meta?.regularMarketPrice,
      quotes
    };
    setBoundedCache(stockChartCache, cacheKey, { ts: Date.now(), data }, 500);
    res.json(data);
  } catch (err) {
    console.error('Stock chart error:', err.message);
    res.status(500).json({ message: `Erro ao obter gráfico: ${err.message}` });
  }
});

app.get('/api/external/stocks/news', async (req, res) => {
  if (!yahooFinance) return res.status(503).json({ message: 'Yahoo Finance unavailable' });
  const symbol = (req.query.symbol || '').trim().toUpperCase();
  if (!symbol) return res.json([]);
  const cacheKey = `news_${symbol}`;
  const cached = stockSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return res.json(cached.data);
  try {
    const result = await yahooFinance.search(symbol, { newsCount: 10, quotesCount: 0 }, { validateResult: false });
    // yahoo-finance2 may return news under different keys depending on version
    const raw = Array.isArray(result) ? result
      : result.news || result.News || result.items || [];
    console.log(`[news] ${symbol} → raw items: ${raw.length}`);
    if (raw.length === 0) {
      // Fallback: try a keyword search using company/index name
      const fallbackMap = { 'SPY': 'ETF stock market', 'BTC-USD': 'Bitcoin crypto', 'JPM': 'banking finance', 'MSFT': 'Microsoft gaming', 'GLD': 'gold commodities' };
      const query = fallbackMap[symbol] || symbol;
      const r2 = await yahooFinance.search(query, { newsCount: 10, quotesCount: 0 }, { validateResult: false });
      raw.push(...(r2.news || r2.News || r2.items || []));
      console.log(`[news] ${symbol} fallback "${query}" → ${raw.length} items`);
    }
    const news = raw.map(n => {
      let ts = n.providerPublishTime;
      if (ts instanceof Date) ts = Math.floor(ts.getTime() / 1000);
      else if (typeof ts === 'string') ts = Math.floor(new Date(ts).getTime() / 1000);
      else if (!ts) ts = Math.floor(Date.now() / 1000);
      const thumb = n.thumbnail?.resolutions?.[1]?.url
        || n.thumbnail?.resolutions?.[0]?.url
        || null;
      return {
        title: n.title || n.headline || '',
        publisher: n.publisher || n.source || n.siteName || '',
        link: n.link || n.url || n.clickThroughUrl?.url || '',
        providerPublishTime: ts,
        thumbnail: thumb,
        relatedTickers: n.relatedTickers || []
      };
    }).filter(n => n.title && n.title.length > 3);
    setBoundedCache(stockSearchCache, cacheKey, { ts: Date.now(), data: news }, 200);
    res.json(news);
  } catch (err) {
    console.error('Stock news error:', err.message);
    res.json([]);
  }
});

app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    service: 'WealthSphere Backend API',
    version: '11',
    endpoints: [
      '/api/health',
      '/api/auth/steam',
      '/api/users/me',
      '/api/external/steam/price',
      '/api/external/steam/inventory',
      '/api/external/steam/float',
      '/api/external/trading212/portfolio'
    ]
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'WealthSphere Backend is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`WealthSphere Backend running on port ${PORT}`);
});

