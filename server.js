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

async function fetchSteamPriceOverview(name) {
  const url = `https://steamcommunity.com/market/priceoverview/`;
  console.log(`Fetching Steam PriceOverview for: ${name}`);
  const response = await axios.get(url, {
    params: {
      appid: 730,
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
    const median = parseMarketPrice(data.median_price);
    const lowest = parseMarketPrice(data.lowest_price);
    const finalPrice = median ?? lowest;
    
    console.log(`  - Steam PriceOverview result for ${name}: median=${median}, lowest=${lowest} -> selected=${finalPrice}`);
    
    return {
      price: finalPrice,
      change24h: null,
      source: median ? 'steam-median' : (lowest ? 'steam-lowest' : 'steam-success')
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

  const user = await User.findById(userId).select('+trading212ApiKey +binanceApiKey');
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
    const { steamId, trading212ApiKey, binanceApiKey } = req.body;

    if (steamId !== undefined) user.steamId = steamId || undefined;
    if (trading212ApiKey !== undefined) user.trading212ApiKey = trading212ApiKey || undefined;
    if (binanceApiKey !== undefined) user.binanceApiKey = binanceApiKey || undefined;

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

app.get('/api/external/steam/inventory', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    
    if (!user || !user.steamId) {
      return res.status(400).json({ message: 'User has no Steam ID linked' });
    }

    const cached = steamInventoryCache.get(user.steamId);
    if (cached && Date.now() - cached.timestamp < 2 * 60 * 1000) {
      return res.json(cached.payload);
    }

    const inventoryUrl = `https://steamcommunity.com/inventory/${user.steamId}/730/2?l=portuguese&count=2000`;
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
        marketable: desc.marketable,
        inspectLink: getInspectLink(desc, asset, user.steamId),
        float: null,
        change24h: null,
        price: null
      };
    }).filter((item) => item.name);

    // Group items by name to reduce API calls
    const itemGroups = new Map();
    items.forEach((item) => {
      const key = item.name;
      if (!itemGroups.has(key)) {
        itemGroups.set(key, { ...item, quantity: 0, assetIds: [] });
      }
      const group = itemGroups.get(key);
      group.quantity++;
      group.assetIds.push(item.assetId);
    });

    const uniqueItems = Array.from(itemGroups.values());
    console.log(`Grouped ${items.length} items into ${uniqueItems.length} unique items`);

    // Fetch prices for unique items using hybrid pricing model
    const itemsWithPrices = [];
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    
    // Pre-warm the Skinport cache if empty or stale
    const spAge = Date.now() - skinportCache.lastUpdated;
    if (skinportCache.data.size === 0 || spAge > 12 * 60 * 60 * 1000) {
      console.log('Skinport cache empty or stale, warming it up before inventory processing...');
      await updateSkinportCache();
    }
    
    for (let i = 0; i < uniqueItems.length; i++) {
      const item = uniqueItems[i];
      // Skip non-marketable items (medalhas, coins, badges, etc.)
      if (!item.marketable) {
        itemsWithPrices.push({ ...item, price: null, change24h: null });
        skippedCount++;
        continue;
      }
      
      try {
        const name = item.name;
        let priceData = null;
        
        // 1. Try Skinport lookup (O(1) from local cache Map)
        const spData = skinportCache.data.get(name);
        if (spData) {
          const price = spData.suggested_price ?? spData.min_price ?? spData.median_price ?? spData.mean_price ?? null;
          if (price !== null) {
            priceData = {
              price: price,
              change24h: null,
              source: 'skinport'
            };
          }
        }
        
        // 2. If not found in Skinport, try Steam PriceOverview
        if (!priceData) {
          console.log(`Item "${name}" not found in Skinport cache. Querying Steam PriceOverview...`);
          try {
            priceData = await fetchSteamPriceOverview(name);
            // Add short delay after hitting Steam to prevent rate limit triggers
            await new Promise(resolve => setTimeout(resolve, 1500));
          } catch (steamErr) {
            console.error(`✗ Steam PriceOverview failed for ${name}:`, steamErr.message);
          }
        }
        
        // 3. If both failed, use local estimation logic
        if (!priceData) {
          console.log(`Using local estimated price for ${name}...`);
          const estPrice = generateEstimatedPrice(name);
          priceData = {
            price: estPrice,
            change24h: null,
            source: 'estimated'
          };
        }
        
        itemsWithPrices.push({
          ...item,
          price: priceData.price,
          change24h: priceData.change24h
        });
        successCount++;
        console.log(`✓ Price for ${item.name}: €${priceData.price} (source: ${priceData.source})`);
      } catch (err) {
        console.error(`✗ Error getting price for ${item.name}:`, err.message);
        itemsWithPrices.push({ ...item, price: null, change24h: null });
        failCount++;
      }
    }
    
    console.log(`Price fetch summary: ${successCount} success, ${failCount} failed, ${skippedCount} skipped (non-marketable)`);

    const payload = {
      count: response.data.total_inventory_count || items.length,
      items: itemsWithPrices.slice(0, 100)
    };

    setBoundedCache(steamInventoryCache, user.steamId, {
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

    const payload = {
      success: true,
      data: {
        environment: environmentName,
        total: calculateTrading212Total(data.positions, data.summary),
        positions: data.positions,
        summary: data.summary
      }
    };

    setBoundedCache(trading212Cache, String(user._id), {
      timestamp: Date.now(),
      payload
    }, 500);

    res.json(payload);
  } catch (err) {
    console.error('Trading 212 API Error:', err.response?.data || err.message);
    res.status(500).json({ message: 'Failed to fetch Trading 212 data' });
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

