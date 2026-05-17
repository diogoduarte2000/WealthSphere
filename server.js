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
const ForumPostSchema = require('./backend/models/ForumPost');
const bcrypt = require('bcryptjs');

const rootEnvPath = fs.existsSync(path.join(__dirname, '.env'))
  ? path.join(__dirname, '.env')
  : path.join(__dirname, 'backend', '.env');

require('dotenv').config({ path: rootEnvPath });

const app = express();
const PORT = process.env.PORT || 5000;
const ForumPost = mongoose.models.ForumPost || mongoose.model('ForumPost', ForumPostSchema);
const steamPriceCache = new Map();
const steamInventoryCache = new Map();
const trading212Cache = new Map();

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

  const user = await User.findById(userId);
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
    const { steamId, trading212ApiKey, binanceApiKey, binanceApiSecret } = req.body;

    if (steamId !== undefined) user.steamId = steamId || undefined;
    if (trading212ApiKey !== undefined) user.trading212ApiKey = trading212ApiKey || undefined;
    if (binanceApiKey !== undefined) user.binanceApiKey = binanceApiKey || undefined;
    if (binanceApiSecret !== undefined) user.binanceApiSecret = binanceApiSecret || undefined;

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
  if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
    return res.json({ price: cached.price });
  }

  try {
    const priceUrl = `https://steamcommunity.com/market/priceoverview/?currency=3&appid=730&market_hash_name=${encodeURIComponent(name)}`;
    const response = await axios.get(priceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 5000
    });

    if (response.data && response.data.success) {
      const priceStr = response.data.lowest_price || response.data.median_price || '0';
      const rawPrice = parseFloat(String(priceStr).replace(/[^0-9,.]/g, '').replace(',', '.'));
      const price = rawPrice > 0 ? rawPrice / 1.15 : 0;
      steamPriceCache.set(name, { price, timestamp: Date.now() });
      return res.json({ price });
    }

    res.json({ price: 0 });
  } catch (err) {
    console.error('Steam Price Error for', name, ':', err.message);
    res.json({ price: 0 });
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
    const items = descriptions.map((desc) => ({
      name: desc.market_hash_name,
      icon: desc.icon_url ? `https://community.cloudflare.steamstatic.com/economy/image/${desc.icon_url}` : '',
      color: desc.name_color || 'ffffff',
      type: desc.type || 'Item',
      tradable: desc.tradable,
      price: null
    }));

    const payload = {
      count: response.data.total_inventory_count || items.length,
      items: items.slice(0, 100)
    };

    steamInventoryCache.set(user.steamId, {
      timestamp: Date.now(),
      payload
    });

    res.json(payload);
  } catch (err) {
    console.error('Steam Inventory Error:', err.message);
    res.status(500).json({ message: 'Failed to fetch Steam inventory' });
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

    let response;
    try {
      response = await axios.get('https://live.trading212.com/api/v0/equity/account/cash', {
        headers: { Authorization: user.trading212ApiKey },
        timeout: 10000
      });
    } catch (liveErr) {
      if (liveErr.response && (liveErr.response.status === 401 || liveErr.response.status === 403)) {
        response = await axios.get('https://demo.trading212.com/api/v0/equity/account/cash', {
          headers: { Authorization: user.trading212ApiKey },
          timeout: 10000
        });
      } else {
        throw liveErr;
      }
    }

    if (!response || !response.data) {
      return res.json({ success: false });
    }

    const payload = {
      success: true,
      data: response.data
    };

    trading212Cache.set(String(user._id), {
      timestamp: Date.now(),
      payload
    });

    res.json(payload);
  } catch (err) {
    console.error('Trading 212 API Error:', err.response?.data || err.message);
    res.status(500).json({ message: 'Failed to fetch Trading 212 data' });
  }
});

app.get('/api/forum', async (_req, res) => {
  try {
    const posts = await ForumPost.find().sort({ createdAt: -1 }).limit(50);
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao carregar fórum' });
  }
});

app.post('/api/forum', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    const { title, content, category, price, game } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    const newPost = new ForumPost({
      title,
      content,
      category,
      price,
      game: game || 'CS2',
      author: {
        id: user._id,
        name: user.displayName || user.name,
        avatar: user.avatar || ''
      }
    });

    await newPost.save();
    res.json({ message: 'Anúncio publicado com sucesso!', post: newPost });
  } catch (err) {
    res.status(err.statusCode || 401).json({ message: err.message || 'Token inválido ou expirado' });
  }
});

app.delete('/api/forum/:id', async (req, res) => {
  try {
    const { user } = await authenticateRequest(req);
    const post = await ForumPost.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post não encontrado' });
    }

    if (post.author.id.toString() !== user._id.toString()) {
      return res.status(403).json({ message: 'Sem permissão para apagar este anúncio' });
    }

    await ForumPost.findByIdAndDelete(req.params.id);
    res.json({ message: 'Anúncio removido' });
  } catch (err) {
    res.status(err.statusCode || 401).json({ message: err.message || 'Erro ao apagar' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'WealthSphere Backend is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`WealthSphere Backend running on port ${PORT}`);
});

