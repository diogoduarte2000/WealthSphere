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
const configuredOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:4200')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (configuredOrigins.includes(origin)) {
    return true;
  }

  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)
    || /^http:\/\/localhost:\d+$/i.test(origin);
}

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS origin blocked: ${origin}`));
  },
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
    nationality: user.nationality || '',
    inventory: user.inventory,
    financialProfile: user.financialProfile,
    customSettings: user.customSettings,
    realEstate: user.realEstate,
    hasTrading212ApiKey: !!user.trading212ApiKey,
    hasTrading212ApiSecret: !!user.trading212ApiSecret,
    hasBinanceApiKey: !!user.binanceApiKey,
    hasBinanceApiSecret: !!user.binanceApiSecret,
    hasKrakenApiKey: !!user.krakenApiKey,
    hasCoinbaseApiKey: !!user.coinbaseApiKey,
    hasWiseApiToken: !!user.wiseApiToken,
    hasCsFloatApiKey: !!user.csFloatApiKey,
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

// Trading 212 uses HTTP Basic auth: Authorization: Basic base64(API_KEY:API_SECRET)
// Legacy keys (single token) are supported by sending the token alone.
function buildTrading212Auth(user) {
  const key = String(user.trading212ApiKey || '').trim();
  const secret = String(user.trading212ApiSecret || '').trim();
  if (key && secret) {
    return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
  }
  // Fallback for legacy single-token keys
  return key;
}

async function t212Get(baseUrl, pathName, authHeader) {
  const r = await axios.get(`${baseUrl}${pathName}`, {
    headers: { Authorization: authHeader },
    timeout: 10000
  });
  return r.data;
}

async function fetchTrading212Resource(baseUrl, pathName, authHeader) {
  try {
    return await t212Get(baseUrl, pathName, authHeader);
  } catch (err) {
    const status = err.response?.status;
    if ([404, 405].includes(status)) {
      const fallback = pathName === '/equity/portfolio' ? '/equity/positions'
        : pathName === '/equity/positions' ? '/equity/portfolio'
        : pathName === '/equity/account/cash' ? '/equity/account/summary'
        : pathName === '/equity/account/summary' ? '/equity/account/cash'
        : null;
      if (fallback) return await t212Get(baseUrl, fallback, authHeader);
    }
    throw err;
  }
}

function calculateTrading212Total(positions, cashInfo) {
  // /equity/account/cash returns { free, total, invested, ppl, result, pieCash, blocked }
  const explicitTotal = Number(cashInfo?.total ?? cashInfo?.totalValue ?? cashInfo?.portfolioValue ?? cashInfo?.accountValue);
  if (Number.isFinite(explicitTotal) && explicitTotal > 0) {
    return explicitTotal;
  }

  const openPositions = Array.isArray(positions) ? positions : [];
  const positionsTotal = openPositions.reduce((sum, position) => {
    const quantity = Number(position.quantity ?? 0);
    const price = Number(position.currentPrice ?? position.averagePrice ?? 0);
    const value = Number(position.currentValue ?? position.value ?? position.marketValue);
    return sum + (Number.isFinite(value) ? value : quantity * price);
  }, 0);

  const free = Number(cashInfo?.free ?? cashInfo?.cash ?? cashInfo?.availableCash ?? 0);
  return positionsTotal + (Number.isFinite(free) ? free : 0);
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

  const user = await User.findById(userId).select('+trading212ApiKey +trading212ApiSecret +binanceApiKey +binanceApiSecret +krakenApiKey +krakenApiSecret +csFloatApiKey');
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
    const { name, email, password, nationality } = req.body;

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
      password: hashedPassword,
      nationality: nationality ? String(nationality).toLowerCase().slice(0, 5) : 'pt'
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

    if (!email || !password) {
      return res.status(400).json({ message: 'Email e password são obrigatórios' });
    }

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
    const { steamId, trading212ApiKey, trading212ApiSecret, binanceApiKey, binanceApiSecret, krakenApiKey, krakenApiSecret, paypalClientId, paypalClientSecret } = req.body;

    if (steamId !== undefined) user.steamId = steamId || undefined;
    if (trading212ApiKey !== undefined) user.trading212ApiKey = trading212ApiKey ? String(trading212ApiKey).trim() : undefined;
    if (trading212ApiSecret !== undefined) user.trading212ApiSecret = trading212ApiSecret ? String(trading212ApiSecret).trim() : undefined;
    if (binanceApiKey !== undefined) user.binanceApiKey = binanceApiKey || undefined;
    if (binanceApiSecret !== undefined) user.binanceApiSecret = binanceApiSecret || undefined;
    if (krakenApiKey !== undefined) user.krakenApiKey = krakenApiKey || undefined;
    if (krakenApiSecret !== undefined) user.krakenApiSecret = krakenApiSecret || undefined;
    if (paypalClientId !== undefined) user.paypalClientId = paypalClientId || undefined;
    if (paypalClientSecret !== undefined) user.paypalClientSecret = paypalClientSecret || undefined;
    if (req.body.csFloatApiKey !== undefined) user.csFloatApiKey = req.body.csFloatApiKey || undefined;

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

app.delete('/api/users/me', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    await user.deleteOne();
    res.json({ message: 'Conta eliminada com sucesso' });
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

// ── Financial Goals ──────────────────────────────────────────────────────────
app.get('/api/users/me/goals', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    res.json(user.financialGoals || []);
  } catch (err) {
    res.status(err.statusCode || 401).json({ message: err.message });
  }
});

app.post('/api/users/me/goals', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    const { label, target, deadline } = req.body;
    if (!label || !target) return res.status(400).json({ message: 'label e target obrigatórios' });
    if (!user.financialGoals) user.financialGoals = [];
    if (user.financialGoals.length >= 5) return res.status(400).json({ message: 'Máximo de 5 metas' });
    user.financialGoals.push({ label, target: Number(target), deadline: deadline || '', notified: false });
    user.markModified('financialGoals');
    await user.save();
    res.json(user.financialGoals);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

app.put('/api/users/me/goals/:id', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    const goal = (user.financialGoals || []).id(req.params.id);
    if (!goal) return res.status(404).json({ message: 'Meta não encontrada' });
    const { label, target, deadline, notified } = req.body;
    if (label !== undefined) goal.label = label;
    if (target !== undefined) goal.target = Number(target);
    if (deadline !== undefined) goal.deadline = deadline;
    if (notified !== undefined) goal.notified = notified;
    user.markModified('financialGoals');
    await user.save();
    res.json(user.financialGoals);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

app.delete('/api/users/me/goals/:id', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    user.financialGoals = (user.financialGoals || []).filter(g => g._id.toString() !== req.params.id);
    user.markModified('financialGoals');
    await user.save();
    res.json(user.financialGoals);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// ── Transactions (Income Tracker) ──────────────────────
app.get('/api/users/me/transactions', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    res.json(user.transactions || []);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

app.post('/api/users/me/transactions', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    const { type, description, amount, category, date } = req.body;
    if (!type || !description || !amount || !date) {
      return res.status(400).json({ message: 'type, description, amount e date são obrigatórios' });
    }
    if (!['receita', 'despesa'].includes(type)) {
      return res.status(400).json({ message: 'type deve ser receita ou despesa' });
    }
    const entry = { type, description, amount: +amount, category: category || '', date, createdAt: new Date() };
    user.transactions = user.transactions || [];
    user.transactions.push(entry);
    user.markModified('transactions');
    await user.save();
    res.status(201).json(user.transactions[user.transactions.length - 1]);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

app.delete('/api/users/me/transactions/:id', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    user.transactions = (user.transactions || []).filter(t => t._id.toString() !== req.params.id);
    user.markModified('transactions');
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
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

// Steam market search (autocomplete for watchlist / ROI)
const steamSearchCache = new Map();
app.get('/api/external/steam/search', async (req, res) => {
  const { q = '', appid = '730', count = '10' } = req.query;
  if (!q || q.length < 2) return res.json({ results: [] });
  const cacheKey = `${appid}:${String(q).toLowerCase()}`;
  const cached = steamSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return res.json(cached.data);

  // For CS2, use Skinport local cache — Steam's search/render API ignores q without auth session
  if (String(appid) === '730') {
    if (skinportCache.data.size === 0) await updateSkinportCache().catch(() => {});
    if (skinportCache.data.size > 0) {
      const searchQ = String(q).toLowerCase();
      const maxCount = Math.min(+count, 20);
      const matches = [];
      for (const [name, item] of skinportCache.data.entries()) {
        const nameLow = name.toLowerCase();
        // Normalize: "AK-47 | Redline (Factory New)" → "ak-47 redline factory new" for flexible matching
        const nameNorm = nameLow.replace(' | ', ' ').replace(/\s*\([^)]+\)/g, '').trim();
        if (nameLow.includes(searchQ) || nameNorm.includes(searchQ)) {
          matches.push({
            name,
            hash_name: name,
            price: item.min_price ?? item.suggested_price ?? null,
            // Free Steam image CDN by market hash name (steamapis.com free image endpoint)
            icon: `https://api.steamapis.com/image/item/730/${encodeURIComponent(name)}`,
            _score: nameLow.startsWith(searchQ) || nameNorm.startsWith(searchQ) ? 0 : 1
          });
        }
      }
      matches.sort((a, b) => a._score - b._score || a.name.localeCompare(b.name));
      const results = matches.slice(0, maxCount).map(({ _score, ...r }) => r);
      const data = { results };
      if (results.length) steamSearchCache.set(cacheKey, { data, ts: Date.now() });
      return res.json(data);
    }
  }

  // Fallback: Steam API (works for non-CS2 games)
  try {
    const r = await axios.get('https://steamcommunity.com/market/search/render/', {
      params: { q, appid, search_descriptions: 0, sort_column: 'popular', sort_dir: 'desc', norender: 1, count: Math.min(+count, 20) },
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://steamcommunity.com/market/', 'Accept-Language': 'en-US,en;q=0.9' },
      timeout: 10000
    });
    const results = (r.data?.results || []).map(item => ({
      name: item.name,
      hash_name: item.hash_name,
      price: (item.sell_price || 0) / 100,
      icon: item.asset_description?.icon_url ? `https://steamcommunity-a.akamaihd.net/economy/image/${item.asset_description.icon_url}/75fx57f` : null
    }));
    const data = { results };
    if (results.length) steamSearchCache.set(cacheKey, { data, ts: Date.now() });
    res.json(data);
  } catch (err) {
    console.error('Steam search error:', err.message);
    res.json({ results: [] });
  }
});

// Steam Top10 per game
const top10Cache = new Map();
app.get('/api/external/steam/top10', async (req, res) => {
  const { game = 'cs2' } = req.query;
  const gameMap = { cs2: 730, rust: 252490, tf2: 440, kf2: 232090, warframe: 230410, h1z1: 433850, unturned: 304930, payday2: 218620 };
  const appid = gameMap[game] || 730;
  const cached = top10Cache.get(String(game));
  if (cached && Date.now() - cached.ts < 30 * 60 * 1000) return res.json(cached.data);
  try {
    const r = await axios.get('https://steamcommunity.com/market/search/render/', {
      params: { appid, search_descriptions: 0, sort_column: 'popular', sort_dir: 'desc', norender: 1, count: 10, start: 0 },
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://steamcommunity.com/market/', 'Accept-Language': 'en-US,en;q=0.9' },
      timeout: 12000
    });
    const items = (r.data?.results || []).map(item => ({
      name: item.name,
      price: (item.sell_price || 0) / 100,
      listings: item.sell_listings || 0,
      icon: item.asset_description?.icon_url ? `https://steamcommunity-a.akamaihd.net/economy/image/${item.asset_description.icon_url}/75fx57f` : null
    }));
    const data = { items };
    if (items.length) top10Cache.set(String(game), { data, ts: Date.now() });
    res.json(data);
  } catch (err) {
    console.error('Top10 error:', err.message);
    res.json({ items: [] });
  }
});

// Price history endpoint — Steam's new UI no longer embeds var line1 in SSR HTML.
// We use the public priceoverview API + Skinport cache as fallback.
const priceHistoryCache = new Map();

app.get('/api/external/steam/price-history', async (req, res) => {
  const { name, appid = '730' } = req.query;
  if (!name) return res.status(400).json({ message: 'Missing name' });

  const cacheKey = `${appid}:${name}`;
  const cached = priceHistoryCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 2 * 60 * 60 * 1000) {
    return res.json(cached.data);
  }

  let history = [];
  let priceOverview = null;

  // 1) Try Steam priceoverview API (public, no auth needed) — gives current price snapshot
  try {
    const overviewUrl = `https://steamcommunity.com/market/priceoverview/?appid=${appid}&currency=3&market_hash_name=${encodeURIComponent(name)}`;
    const overviewRes = await axios.get(overviewUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      timeout: 8000
    });
    const ov = overviewRes.data;
    if (ov && ov.success) {
      // Steam returns prices like "€0,72" — parse to float
      const parseEur = (s) => s ? parseFloat(String(s).replace(/[^\d,\.]/g, '').replace(',', '.')) : null;
      priceOverview = {
        lowest: parseEur(ov.lowest_price),
        median: parseEur(ov.median_price),
        volume: ov.volume || null,
        currency: 'EUR',
        steamUrl: `https://steamcommunity.com/market/listings/${appid}/${encodeURIComponent(name)}`
      };
    }
  } catch (e) {
    console.warn('Steam priceoverview failed:', e.message);
  }

  // 2) Augment with Skinport cache if available (CS2 only)
  if (String(appid) === '730' && skinportCache.data.size > 0) {
    const skinportItem = skinportCache.data.get(name);
    if (skinportItem) {
      const sp = {
        min: skinportItem.min_price ?? null,
        max: skinportItem.max_price ?? null,
        suggested: skinportItem.suggested_price ?? null,
        quantity: skinportItem.quantity ?? null,
      };
      priceOverview = {
        ...(priceOverview || {}),
        skinport: sp,
        steamUrl: priceOverview?.steamUrl || `https://steamcommunity.com/market/listings/${appid}/${encodeURIComponent(name)}`
      };
      // If we have a current price but no overview from Steam, fill in from Skinport
      if (!priceOverview.lowest && sp.min) priceOverview.lowest = sp.min / 100;
      if (!priceOverview.median && sp.suggested) priceOverview.median = sp.suggested / 100;
    }
  }

  const data = { history, priceOverview };
  // Cache for 2h even when history is empty (priceOverview is still useful)
  priceHistoryCache.set(cacheKey, { data, ts: Date.now() });
  res.json(data);
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

      // Helper to parse CSFloat-style response
      function parseFloatResponse(data) {
        const info = data?.iteminfo || data;
        return {
          float: typeof info?.floatvalue === 'number' ? info.floatvalue : null,
          paintSeed: info?.paintseed ?? null,
          paintIndex: info?.paintindex ?? null
        };
      }

      // 1. If user has a CSFloat API key, use authenticated endpoint first
      if (user.csFloatApiKey) {
        try {
          const fr = await axios.get('https://csfloat.com/api/v1/', {
            params: { url: item.inspectLink },
            headers: { 'User-Agent': 'Mozilla/5.0', 'Authorization': `Bearer ${user.csFloatApiKey}` },
            timeout: 12000
          });
          const payload = parseFloatResponse(fr.data);
          if (payload.float !== null) {
            setBoundedCache(steamFloatCache, cacheKey, { payload, timestamp: Date.now() }, 5000);
            return { assetId: item.assetId, ...payload };
          }
        } catch (err) {
          if (err.response?.status !== 401 && err.response?.status !== 403) {
            // non-auth error, fall through to free endpoints
          }
        }
      }

      // 2. Free endpoints — try steam.supply first, then legacy fallbacks
      const FLOAT_ENDPOINTS = [
        { url: 'https://api.steam.supply/float', paramName: 'url' },
        { url: 'https://api.csfloat.com/',       paramName: 'url' },
        { url: 'https://api.csgofloat.com/',     paramName: 'url' },
      ];
      for (const endpoint of FLOAT_ENDPOINTS) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const fr = await axios.get(endpoint.url, {
              params: { [endpoint.paramName]: item.inspectLink },
              headers: { 'User-Agent': 'Mozilla/5.0' },
              timeout: 12000
            });
            const payload = parseFloatResponse(fr.data);
            if (payload.float !== null) {
              setBoundedCache(steamFloatCache, cacheKey, { payload, timestamp: Date.now() }, 5000);
              return { assetId: item.assetId, ...payload };
            }
          } catch (err) {
            const isTransient = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.response?.status === 429;
            const isDnsFail = err.code === 'ENOTFOUND';
            if (isDnsFail) break;
            if (isTransient && attempt < 2) {
              await new Promise(r => setTimeout(r, 1500));
              continue;
            }
          }
        }
      }

      return { assetId: item.assetId, float: null, paintSeed: null, paintIndex: null };
    }

    const floatByAssetId = new Map();
    const FLOAT_CONCURRENCY = 2;
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

  function parseInfo(data) {
    const info = data?.iteminfo || data;
    return {
      float: typeof info?.floatvalue === 'number' ? info.floatvalue : null,
      paintSeed: info?.paintseed ?? null,
      paintIndex: info?.paintindex ?? null
    };
  }

  // Try authenticated CSFloat first if user is logged in and has key
  try {
    const { user } = await authenticateRequest(req).catch(() => ({ user: null }));
    if (user?.csFloatApiKey) {
      const r = await axios.get('https://csfloat.com/api/v1/', {
        params: { url: inspectLink },
        headers: { 'User-Agent': 'Mozilla/5.0', 'Authorization': `Bearer ${user.csFloatApiKey}` },
        timeout: 10000
      });
      const payload = { ...parseInfo(r.data), source: 'csfloat-auth' };
      if (payload.float !== null) {
        setBoundedCache(steamFloatCache, cacheKey, { payload, timestamp: Date.now() }, 5000);
        return res.json(payload);
      }
    }
  } catch (_) {}

  const FLOAT_ENDPOINTS = ['https://api.csfloat.com/', 'https://api.csgofloat.com/'];
  for (const baseUrl of FLOAT_ENDPOINTS) {
    try {
      const response = await axios.get(baseUrl, {
        params: { url: inspectLink },
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      });
      const payload = { ...parseInfo(response.data), source: baseUrl.includes('csgofloat') ? 'csgofloat' : 'csfloat' };
      if (payload.float !== null) {
        setBoundedCache(steamFloatCache, cacheKey, { payload, timestamp: Date.now() }, 5000);
        return res.json(payload);
      }
    } catch (err) {
      if (err.code === 'ENOTFOUND') continue;
      console.error('Steam Float Error:', err.response?.data || err.message);
    }
  }
  res.json({ float: null, paintSeed: null, paintIndex: null, source: 'unavailable' });
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

    const authHeader = buildTrading212Auth(user);
    let data = null;
    let environmentName = 'live';

    const ENVIRONMENTS = [
      { name: 'live', baseUrl: 'https://live.trading212.com/api/v0' },
      { name: 'demo', baseUrl: 'https://demo.trading212.com/api/v0' },
    ];

    let lastErr = null;
    for (const env of ENVIRONMENTS) {
      try {
        const positions = await fetchTrading212Resource(env.baseUrl, '/equity/portfolio', authHeader);
        const summary = await fetchTrading212Resource(env.baseUrl, '/equity/account/cash', authHeader);
        data = { positions, summary };
        environmentName = env.name;
        lastErr = null;
        break;
      } catch (envErr) {
        lastErr = envErr;
        const status = envErr.response?.status;
        // Only fall through to demo if live returned 401/403 (could be a demo-only key)
        if (env.name === 'live' && status !== 401 && status !== 403) throw envErr;
        // If demo also fails, propagate with T212's actual error message attached
        if (env.name === 'demo') throw envErr;
      }
    }
    if (lastErr) throw lastErr;

    if (!data) {
      return res.json({ success: false });
    }

    const total = calculateTrading212Total(data.positions, data.summary);

    // /equity/account/cash response: { free, total, invested, ppl, result, pieCash, blocked }
    const cash = Number(data.summary?.free ?? data.summary?.cash ?? data.summary?.availableCash ?? 0);

    const positions = Array.isArray(data.positions) ? data.positions : [];
    const positionsValue = positions.reduce((sum, p) => {
      const val = Number(p.currentValue ?? p.currentPrice * p.quantity ?? 0);
      return sum + val;
    }, 0);
    const totalPpl = positions.reduce((sum, p) => {
      return sum + Number(p.ppl ?? p.unrealizedProfitLoss ?? 0);
    }, 0);
    // T212 /equity/account/cash already has invested and result fields
    const invested = Number(data.summary?.invested ?? Math.max(0, positionsValue - totalPpl));
    const result = Number(data.summary?.result ?? totalPpl);

    const payload = {
      success: true,
      data: {
        environment: environmentName,
        total,
        cash,           // uninvested balance
        positionsValue, // current value of all positions
        invested,       // cost basis of positions (EUR)
        result,         // unrealised P&L (EUR)
        positions,
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
      await PortfolioSnapshot.findOneAndUpdate(
        { user: user._id, date: today, source: 'trading212' },
        { total, positionsValue, cash, invested, result },
        { upsert: true, new: true }
      );
    } catch (snapErr) { /* non-critical */ }

    res.json(payload);
  } catch (err) {
    const status = err.response?.status;
    const t212Body = err.response?.data;
    const t212Msg = t212Body?.message || (typeof t212Body === 'string' ? t212Body : null);
    console.error(`Trading 212 API Error [${status}]:`, t212Body || err.message);
    let msg;
    if (status === 401) {
      msg = `API key Trading 212 inválida (401${t212Msg ? ': ' + t212Msg : ''}). Verifica se copiaste a key corretamente.`;
    } else if (status === 403) {
      msg = `API key Trading 212 sem permissões (403${t212Msg ? ': ' + t212Msg : ''}). A key precisa de ter permissão "Equity" habilitada.`;
    } else if (status === 429) {
      msg = 'Trading 212 rate limit atingido — tenta novamente em 1 minuto.';
    } else {
      msg = `Erro ao comunicar com Trading 212 (${status || err.message}${t212Msg ? ': ' + t212Msg : ''})`;
    }
    res.status(500).json({ message: msg });
  }
});

// T212 key diagnostic — returns raw T212 response for debugging
app.get('/api/external/trading212/test', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    if (!user?.trading212ApiKey) return res.status(400).json({ message: 'No T212 key saved' });

    const key = String(user.trading212ApiKey || '').trim();
    const secret = String(user.trading212ApiSecret || '').trim();
    const basic = key && secret ? 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64') : null;
    const results = [];

    const authVariants = [];
    if (basic) authVariants.push(['Basic', basic]);
    authVariants.push(['plain', key]);

    for (const baseUrl of ['https://live.trading212.com/api/v0', 'https://demo.trading212.com/api/v0']) {
      for (const [authLabel, auth] of authVariants) {
        const env = baseUrl.includes('live') ? 'live' : 'demo';
        try {
          const r = await axios.get(`${baseUrl}/equity/account/cash`, {
            headers: { Authorization: auth },
            timeout: 10000
          });
          results.push({ env, auth: authLabel, status: r.status, data: r.data });
          break;
        } catch (e) {
          results.push({
            env, auth: authLabel,
            status: e.response?.status || null,
            error: e.message,
            t212Response: e.response?.data
          });
        }
      }
    }

    res.json({
      keyLength: key.length,
      secretLength: secret.length,
      hasBasicAuth: !!basic,
      results
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
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

    // Euribor: ECB SDMX API — all in parallel with short timeout
    try {
      const euriborSeries = [
        { key: 'euribor3m',  seriesKey: 'M.U2.EUR.RT0.MM.EURIBOR3MD_.HSTA' },
        { key: 'euribor6m',  seriesKey: 'M.U2.EUR.RT0.MM.EURIBOR6MD_.HSTA' },
        { key: 'euribor12m', seriesKey: 'M.U2.EUR.RT0.MM.EURIBOR1YD_.HSTA' },
      ];
      const ecbHeaders = {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://data.ecb.europa.eu',
        'Referer': 'https://data.ecb.europa.eu/',
      };
      const euriborResults = await Promise.allSettled(euriborSeries.map(({ seriesKey }) =>
        axios.get(`https://data-api.ecb.europa.eu/service/data/FM/${seriesKey}?lastNObservations=1&format=jsondata`,
          { timeout: 6000, headers: ecbHeaders })
      ));
      euriborSeries.forEach(({ key }, i) => {
        const r = euriborResults[i];
        if (r.status === 'fulfilled') {
          const seriesData = r.value.data?.dataSets?.[0]?.series;
          if (seriesData) {
            const obs = seriesData[Object.keys(seriesData)[0]]?.observations;
            if (obs) {
              const lastObs = Object.values(obs).pop();
              results[key] = Array.isArray(lastObs) ? lastObs[0] : lastObs;
            }
          }
        }
      });
    } catch (e) { console.warn('ECB Euribor error:', e.message); }

    // Live indices via Yahoo Finance (same yfGet helper used for stocks)
    try {
      const indexTickers = [
        { key: 'sp500',    symbol: '^GSPC'     },
        { key: 'nasdaq',   symbol: '^IXIC'     },
        { key: 'stoxx50',  symbol: '^STOXX50E' },
        { key: 'psi20',    symbol: 'PSI20.LS'  },
      ];
      const indexResults = await Promise.allSettled(indexTickers.map(({ symbol }) =>
        yfGet(`/v8/finance/chart/${encodeURIComponent(symbol)}`, { range: '1d', interval: '1d' })
      ));
      indexTickers.forEach(({ key }, i) => {
        if (indexResults[i].status === 'fulfilled') {
          const m = indexResults[i].value?.chart?.result?.[0]?.meta;
          if (m?.regularMarketPrice) {
            results[key] = { price: m.regularMarketPrice, change: m.regularMarketChangePercent ?? null };
          }
        }
      });
    } catch (e) { console.warn('Yahoo indices error:', e.message); }

    // Euribor fallback: use last known values if ECB API failed
    if (results.euribor3m == null)  results.euribor3m  = 2.28;  // approximate Jun 2026
    if (results.euribor6m == null)  results.euribor6m  = 2.18;
    if (results.euribor12m == null) results.euribor12m = 1.99;
    results.euriborFallback = results.euribor3m === 2.28; // flag so UI can indicate estimated

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
    const isAuthErr = err.message?.includes('jwt') || err.message?.includes('token') || err.status === 401 || err.statusCode === 401;
    if (isAuthErr) {
      return res.status(401).json({ message: 'Sessão expirada — faz login novamente' });
    }
    const msg = err.response?.data?.msg || err.message;
    console.error('Binance API Error:', msg);
    res.status(500).json({ message: msg || 'Erro ao contactar Binance' });
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
    const isAuthErrK = err.message?.includes('jwt') || err.message?.includes('token') || err.status === 401;
    if (isAuthErrK) return res.status(401).json({ message: 'Sessão expirada — faz login novamente' });
    res.status(500).json({ message: msg || 'Erro ao contactar Kraken' });
  }
});

// ==========================================
//              COINBASE API (v2 HMAC)
// ==========================================
const coinbaseBalanceCache = new Map();

app.get('/api/external/coinbase/balance', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    if (!user.coinbaseApiKey || !user.coinbaseApiSecret) {
      return res.status(400).json({ message: 'Coinbase API Key e Secret não configurados' });
    }

    const cached = coinbaseBalanceCache.get(String(user._id));
    if (cached && Date.now() - cached.timestamp < 60_000) {
      return res.json(cached.payload);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const method = 'GET';
    const requestPath = '/v2/accounts?limit=100';
    const body = '';
    const message = `${timestamp}${method}${requestPath}${body}`;
    const signature = crypto.createHmac('sha256', user.coinbaseApiSecret).update(message).digest('hex');

    const response = await axios.get(`https://api.coinbase.com${requestPath}`, {
      headers: {
        'CB-ACCESS-KEY': user.coinbaseApiKey,
        'CB-ACCESS-SIGN': signature,
        'CB-ACCESS-TIMESTAMP': String(timestamp),
        'CB-VERSION': '2016-02-18',
      },
      timeout: 10000
    });

    const accounts = (response.data.data || [])
      .filter(a => parseFloat(a.balance?.amount || 0) > 0)
      .map(a => ({
        asset: a.balance.currency,
        total: parseFloat(a.balance.amount),
        name: a.name
      }));

    const payload = { success: true, balances: accounts };
    setBoundedCache(coinbaseBalanceCache, String(user._id), { timestamp: Date.now(), payload }, 500);
    res.json(payload);
  } catch (err) {
    const isAuthErr = err.message?.includes('jwt') || err.message?.includes('token') || err.status === 401 || err.statusCode === 401;
    if (isAuthErr) return res.status(401).json({ message: 'Sessão expirada' });
    const msg = err.response?.data?.errors?.[0]?.message || err.message;
    console.error('Coinbase API Error:', msg);
    res.status(500).json({ message: msg || 'Erro ao contactar Coinbase' });
  }
});

// Guardar chaves Coinbase
app.post('/api/users/me/coinbase', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    const { apiKey, apiSecret } = req.body;
    if (!apiKey || !apiSecret) return res.status(400).json({ message: 'API Key e Secret obrigatórios' });
    user.coinbaseApiKey = apiKey;
    user.coinbaseApiSecret = apiSecret;
    await user.save();
    coinbaseBalanceCache.delete(String(user._id));
    res.json({ success: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// Guardar token Wise
app.post('/api/users/me/wise', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    const { apiToken } = req.body;
    if (!apiToken) return res.status(400).json({ message: 'Token obrigatório' });
    user.wiseApiToken = apiToken;
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// Wise balance
app.get('/api/external/wise/balance', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    if (!user.wiseApiToken) return res.status(400).json({ message: 'Wise token não configurado' });

    // Get profiles first
    const profilesResp = await axios.get('https://api.wise.com/v1/profiles', {
      headers: { Authorization: `Bearer ${user.wiseApiToken}` },
      timeout: 8000
    });
    const personalProfile = profilesResp.data.find(p => p.type === 'PERSONAL') || profilesResp.data[0];
    if (!personalProfile) return res.status(404).json({ message: 'Perfil Wise não encontrado' });

    // Get balances
    const balancesResp = await axios.get(
      `https://api.wise.com/v4/profiles/${personalProfile.id}/balances?types=STANDARD`,
      { headers: { Authorization: `Bearer ${user.wiseApiToken}` }, timeout: 8000 }
    );

    const balances = (balancesResp.data || [])
      .filter(b => b.amount?.value > 0)
      .map(b => ({ currency: b.amount.currency, amount: b.amount.value }));

    res.json({ success: true, balances });
  } catch (err) {
    const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.message || err.message;
    console.error('Wise API Error:', msg);
    res.status(500).json({ message: msg || 'Erro ao contactar Wise' });
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

// GET specific post and increment views (unique per user)
app.get('/api/forum/:id', async (req, res) => {
  try {
    let userId = null;
    try { const auth = await authenticateRequest(req); userId = auth.user._id; } catch {}
    
    const updateOp = userId
      ? { $addToSet: { viewedBy: userId }, $set: {} }
      : {};
    // Always fetch, only increment if new unique viewer
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post não encontrado' });

    if (userId) {
      const alreadyViewed = post.viewedBy.some(id => id.toString() === userId.toString());
      if (!alreadyViewed) {
        post.viewedBy.push(userId);
        post.views = (post.views || 0) + 1;
        await post.save();
      }
    } else {
      post.views = (post.views || 0) + 1;
      await post.save();
    }
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

    // One post per user
    const existingPost = await Post.findOne({ author: user._id });
    if (existingPost) {
      return res.status(409).json({ message: 'Já criaste um post no fórum. Podes editar o existente.' });
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
    const uid = user._id.toString();
    res.json({ votes: post.votes, upvoted: post.upvotedBy.some(id => id.toString() === uid), downvoted: post.downvotedBy.some(id => id.toString() === uid) });
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

    // One reply per user per comment
    const alreadyReplied = comment.replies.some(r => r.author.toString() === user._id.toString());
    if (alreadyReplied) {
      return res.status(409).json({ message: 'Já respondeste a este comentário.' });
    }

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
// Uses direct axios calls to Yahoo Finance API (no library dependency)
const YF_BASE = 'https://query1.finance.yahoo.com';
const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://finance.yahoo.com',
  'Referer': 'https://finance.yahoo.com',
};

let _yfCookie = '';
let _yfCrumb  = '';
let _yfCrumbTs = 0;
const YF_CRUMB_TTL = 6 * 60 * 60 * 1000; // 6 hours

async function yfRefreshCrumb() {
  try {
    const r1 = await axios.get('https://fc.yahoo.com', {
      timeout: 8000, headers: YF_HEADERS, maxRedirects: 5,
      validateStatus: s => s < 500
    });
    const setCookies = r1.headers['set-cookie'] || [];
    _yfCookie = setCookies.map(c => c.split(';')[0]).join('; ');
    const r2 = await axios.get(`${YF_BASE}/v1/test/getcrumb`, {
      timeout: 8000, headers: { ...YF_HEADERS, Cookie: _yfCookie }
    });
    _yfCrumb = typeof r2.data === 'string' ? r2.data.trim() : String(r2.data).trim();
    _yfCrumbTs = Date.now();
    console.log('[YF] Crumb refreshed OK');
  } catch(e) {
    console.warn('[YF] Crumb refresh failed:', e.message);
  }
}

async function yfGet(path, params = {}) {
  if (!_yfCrumb || Date.now() - _yfCrumbTs > YF_CRUMB_TTL) await yfRefreshCrumb();
  if (_yfCrumb) params.crumb = _yfCrumb;
  try {
    const r = await axios.get(`${YF_BASE}${path}`, {
      params, timeout: 10000,
      headers: { ...YF_HEADERS, Cookie: _yfCookie }
    });
    return r.data;
  } catch(e) {
    if (e.response?.status === 401 || e.response?.status === 403) {
      // Crumb expired, refresh and retry once
      _yfCrumb = '';
      await yfRefreshCrumb();
      if (_yfCrumb) params.crumb = _yfCrumb;
      const r = await axios.get(`${YF_BASE}${path}`, {
        params, timeout: 10000,
        headers: { ...YF_HEADERS, Cookie: _yfCookie }
      });
      return r.data;
    }
    throw e;
  }
}

const stockSearchCache = new Map();
const stockQuoteCache  = new Map();
const stockChartCache  = new Map();
const STOCK_SEARCH_TTL = 5 * 60 * 1000;   // 5 min
const STOCK_QUOTE_TTL  = 2 * 60 * 1000;   // 2 min
const STOCK_CHART_TTL  = 10 * 60 * 1000;  // 10 min

app.get('/api/external/stocks/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const cacheKey = q.toLowerCase();
  const cached = stockSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < STOCK_SEARCH_TTL) return res.json(cached.data);
  try {
    const data = await yfGet('/v1/finance/search', { q, newsCount: 0, quotesCount: 10, lang: 'en-US', region: 'US' });
    const quotes = (data.quotes || [])
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
  cripto:     ['BTC-USD','ETH-USD','SOL-USD','BNB-USD','XRP-USD','ADA-USD','DOGE-USD','AVAX-USD'],
  dividendos: ['JNJ','KO','PG','VZ','T','MMM','MO','O','HDV','SCHD'],
  materiais:  ['GLD','SLV','USO','GDX','XLB','PDBC','PICK','WEAT','DBA','CORN'],
};
const trendingCache = new Map();
const TRENDING_TTL = 5 * 60 * 1000;

app.get('/api/external/stocks/trending', async (req, res) => {
  const cat = (req.query.cat || 'tendencias').toLowerCase();
  const symbols = TRENDING_CATEGORIES[cat] || TRENDING_CATEGORIES.tendencias;
  const cacheKey = cat;
  const cached = trendingCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TRENDING_TTL) return res.json(cached.data);
  try {
    const results = await Promise.allSettled(
      symbols.map(async s => {
        const yfData = await yfGet(`/v8/finance/chart/${encodeURIComponent(s)}`, {
          range: '1d', interval: '1d', lang: 'en-US', region: 'US'
        });
        const m = yfData.chart?.result?.[0]?.meta;
        if (!m) return null;
        const prev = m.chartPreviousClose || m.previousClose || 0;
        const price = m.regularMarketPrice || 0;
        return {
          symbol: m.symbol || s,
          shortName: m.shortName || s,
          price,
          change: price - prev,
          changePct: prev ? ((price - prev) / prev) * 100 : 0,
          currency: m.currency || 'USD',
          quoteType: m.instrumentType || '',
          exchange: m.exchangeName || '',
        };
      })
    );
    const data = results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean);
    setBoundedCache(trendingCache, cacheKey, { ts: Date.now(), data }, 20);
    res.json(data);
  } catch (err) {
    console.error('Trending stocks error:', err.message);
    res.status(500).json({ message: 'Erro ao carregar tendências' });
  }
});

app.get('/api/external/stocks/quote', async (req, res) => {
  const symbol = (req.query.symbol || '').trim().toUpperCase();
  if (!symbol) return res.status(400).json({ message: 'Symbol required' });
  const cached = stockQuoteCache.get(symbol);
  if (cached && Date.now() - cached.ts < STOCK_QUOTE_TTL) return res.json(cached.data);
  try {
    const yfData = await yfGet(`/v8/finance/chart/${encodeURIComponent(symbol)}`, {
      range: '1d', interval: '1d', lang: 'en-US', region: 'US'
    });
    const result = yfData.chart?.result?.[0];
    if (!result) return res.status(404).json({ message: 'Symbol not found' });
    const m = result.meta || {};
    const prev = m.chartPreviousClose || m.previousClose || 0;
    const price = m.regularMarketPrice || 0;
    const data = {
      symbol: m.symbol || symbol,
      shortName: m.shortName || symbol,
      longName: m.longName || m.shortName || symbol,
      currency: m.currency || 'USD',
      regularMarketPrice: price,
      regularMarketChange: price - prev,
      regularMarketChangePercent: prev ? ((price - prev) / prev) * 100 : 0,
      regularMarketPreviousClose: prev,
      regularMarketOpen: m.regularMarketOpen || price,
      regularMarketDayHigh: m.regularMarketDayHigh || price,
      regularMarketDayLow: m.regularMarketDayLow || price,
      regularMarketVolume: m.regularMarketVolume || 0,
      fiftyTwoWeekHigh: m.fiftyTwoWeekHigh || 0,
      fiftyTwoWeekLow: m.fiftyTwoWeekLow || 0,
      marketCap: m.marketCap || null,
      trailingPE: m.trailingPE || null,
      exchange: m.exchangeName || '',
      quoteType: m.instrumentType || '',
      marketState: m.marketState || 'CLOSED'
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
  const symbol = (req.query.symbol || '').trim().toUpperCase();
  const period = req.query.period || '1mo';
  if (!symbol) return res.status(400).json({ message: 'Symbol required' });
  const cacheKey = `${symbol}_${period}`;
  const cached = stockChartCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < STOCK_CHART_TTL) return res.json(cached.data);
  try {
    const days = PERIOD_MAP[period] || 30;
    const interval = INTERVAL_MAP[period] || '1d';
    const rangeMap = { 1: '1d', 5: '5d', 30: '1mo', 90: '3mo', 180: '6mo', 365: '1y', 730: '2y', 1825: '5y' };
    const range = rangeMap[days] || '1mo';
    const yfData = await yfGet(`/v8/finance/chart/${encodeURIComponent(symbol)}`, {
      range, interval, lang: 'en-US', region: 'US'
    });
    const result = yfData.chart?.result?.[0];
    if (!result) return res.status(404).json({ message: 'Symbol not found' });
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    const opens = result.indicators?.quote?.[0]?.open || [];
    const highs = result.indicators?.quote?.[0]?.high || [];
    const lows = result.indicators?.quote?.[0]?.low || [];
    const volumes = result.indicators?.quote?.[0]?.volume || [];
    const quotes = timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString(),
      open: opens[i] ?? null,
      high: highs[i] ?? null,
      low: lows[i] ?? null,
      close: closes[i] ?? null,
      volume: volumes[i] ?? null
    })).filter(q => q.close != null);
    const data = {
      symbol,
      currency: result.meta?.currency,
      regularMarketPrice: result.meta?.regularMarketPrice,
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
  const symbol = (req.query.symbol || '').trim().toUpperCase();
  if (!symbol) return res.json([]);
  const cacheKey = `news_${symbol}`;
  const cached = stockSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return res.json(cached.data);
  try {
    const data = await yfGet('/v1/finance/search', { q: symbol, newsCount: 10, quotesCount: 0, lang: 'en-US', region: 'US' });
    const raw = data.news || [];
    const news = raw.map(n => ({
      title: n.title || '',
      publisher: n.publisher || '',
      link: n.link || '',
      providerPublishTime: n.providerPublishTime || Math.floor(Date.now() / 1000),
      thumbnail: n.thumbnail?.resolutions?.[1]?.url || n.thumbnail?.resolutions?.[0]?.url || null,
      relatedTickers: n.relatedTickers || []
    })).filter(n => n.title && n.title.length > 3);
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
    version: '12',
    endpoints: ['/api/health', '/api/auth/steam', '/api/users/me']
  });
});

// Crypto prices via CoinGecko (proxied to avoid CORS + auth interceptor issues)
const cryptoPriceCache = new Map();
app.get('/api/external/crypto/prices', async (req, res) => {
  const ids = (req.query.ids || 'bitcoin,ethereum,solana,ripple,cardano,polkadot,chainlink,avalanche-2,matic-network,dogecoin').toString();
  const cacheKey = ids;
  const cached = cryptoPriceCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 60 * 1000) return res.json(cached.data); // 1min cache
  try {
    const resp = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=eur&include_24hr_change=true`,
      { timeout: 8000 }
    );
    const data = resp.data || {};
    setBoundedCache(cryptoPriceCache, cacheKey, { ts: Date.now(), data }, 10);
    res.json(data);
  } catch (err) {
    console.warn('CoinGecko error:', err.message);
    res.status(502).json({ error: 'CoinGecko unavailable' });
  }
});

// ── Public Binance market data (no auth) ──
const binanceMarketCache = new Map();
function cachedBinance(key, url, ttlMs = 3000) {
  const hit = binanceMarketCache.get(key);
  if (hit && Date.now() - hit.ts < ttlMs) return Promise.resolve(hit.data);
  return axios.get(url, { timeout: 6000 }).then(r => {
    setBoundedCache(binanceMarketCache, key, { ts: Date.now(), data: r.data }, 100);
    return r.data;
  });
}

app.get('/api/external/crypto/orderbook', async (req, res) => {
  try {
    const symbol = (req.query.symbol || 'BTCUSDT').toString().toUpperCase();
    const data = await cachedBinance(`ob_${symbol}`, `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=15`);
    res.json(data);
  } catch (err) { res.status(502).json({ message: err.message }); }
});

app.get('/api/external/crypto/trades', async (req, res) => {
  try {
    const symbol = (req.query.symbol || 'BTCUSDT').toString().toUpperCase();
    const data = await cachedBinance(`tr_${symbol}`, `https://api.binance.com/api/v3/trades?symbol=${symbol}&limit=25`, 2000);
    res.json(data);
  } catch (err) { res.status(502).json({ message: err.message }); }
});

app.get('/api/external/crypto/ticker24h', async (req, res) => {
  try {
    const symbol = (req.query.symbol || 'BTCUSDT').toString().toUpperCase();
    const data = await cachedBinance(`tk_${symbol}`, `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, 10000);
    res.json(data);
  } catch (err) { res.status(502).json({ message: err.message }); }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'WealthSphere Backend is running' });
});

app.listen(PORT, () => {
  console.log(`WealthSphere Backend running on port ${PORT}`);
});
