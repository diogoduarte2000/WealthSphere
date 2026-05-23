const express = require('express');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const session = require('express-session');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// MongoDB Connections
const mainDB = mongoose.createConnection(process.env.MONGO_URI, { dbName: 'wealthsphere_main' });
mainDB.on('connected', () => console.log('Connected to Main Database (WealthSphere)'));

const forumDB = mongoose.createConnection(process.env.MONGO_URI, { dbName: 'wealthsphere_community' });
forumDB.on('connected', () => console.log('Connected to Community Database (Forum)'));

// Models using specific connections
const User = mainDB.model('User', require('./models/User').schema);
const ForumPostSchema = require('./models/ForumPost');
const ForumPost = forumDB.model('ForumPost', ForumPostSchema);

// Middleware
// Dynamic CORS configuration supporting local dev and Vercel domains
const allowedOrigins = process.env.CLIENT_ORIGIN 
  ? process.env.CLIENT_ORIGIN.split(',') 
  : ['http://localhost:4200', 'http://localhost:4201', 'https://wealthsphere.vercel.app'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.includes(origin) || 
                      origin.endsWith('.vercel.app') || 
                      origin.includes('localhost');
                      
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration (Required for passport-steam)
app.use(session({
  secret: process.env.SESSION_SECRET || 'wealthsphere-secret',
  resave: true,
  saveUninitialized: true,
  cookie: {
    secure: false,
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

    // Verificar se já existe
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email já registado' });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      displayName: name,
      email,
      password: hashedPassword
    });

    const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const refreshToken = 'mock_refresh_' + Math.random().toString(36).substring(7);

    res.status(201).json({
      message: 'Utilizador criado com sucesso',
      user: { id: user._id, name: user.displayName, email: user.email },
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

    const user = await User.findOne({ email });
    console.log('Login attempt for email:', email);
    
    if (!user) {
      console.log('User not found');
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
      console.log('Bcrypt compare error (possibly plain text password)');
    }

    // Fallback for plain text passwords (transition period)
    if (!isMatch && password === storedHash) {
      console.log('Plain text password match detected. Upgrading to hash...');
      isMatch = true;
    }

    if (!isMatch) {
      console.log('Password mismatch');
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    // Cleanup: If user had legacy field names, unify them
    if (user.passwordHash || user.name) {
      console.log('Migrating legacy fields for user:', email);
      user.password = await bcrypt.hash(password, 10);
      user.displayName = user.displayName || user.name;
      // Optional: keep legacy fields for now to avoid breaking other things if any
      await user.save();
    }

    const accessToken = jwt.sign({ id: user._id, steamId: user.steamId }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const refreshToken = 'mock_refresh_' + Math.random().toString(36).substring(7);

    res.json({
      message: 'Login efetuado',
      user: { id: user._id, name: user.displayName, email: user.email, steamId: user.steamId },
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
  (req, res) => {
    // Limpar o linkUserId da sessão
    const wasLinking = req.session.linkUserId;
    delete req.session.linkUserId;

    // Gerar JWT
    const token = jwt.sign(
      { id: req.user._id, steamId: req.user.steamId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const redirectUrl = `${frontendUrl}/auth?token=${token}&refresh=mock_refresh${wasLinking ? '&linked=true' : ''}`;
    console.log('Steam Auth Success. Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  }
);

// Rota para desassociar conta Steam
app.post('/api/users/unlink-steam', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.sub;
    const user = await User.findByIdAndUpdate(
      userId, 
      { 
        $unset: { 
          steamId: "", 
          steamName: "", 
          steamAvatar: "" 
        } 
      },
      { new: true }
    );
    
    if (user) {
      return res.json({ message: 'Steam account unlinked successfully', profile: user });
    }
    res.status(404).json({ message: 'User not found' });
  } catch (err) {
    console.error('Unlink Steam error:', err);
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Rota para atualizar perfil básico (nome)
app.patch('/api/users/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { displayName } = req.body;
    console.log('Updating profile for user:', decoded.id, 'New name:', displayName);
    
    const user = await User.findByIdAndUpdate(
      decoded.id, 
      { $set: { displayName, name: displayName } },
      { new: true }
    ).select('-password -passwordHash');

    if (!user) {
      console.log('User not found during update');
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'Perfil atualizado', profile: user });
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Rota para eliminar a propria conta
app.delete('/api/users/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.sub;

    const user = await User.findByIdAndDelete(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await ForumPost.deleteMany({ 'author.id': userId });
    res.json({ message: 'Conta eliminada' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Rota para atualizar chaves de API externas
app.patch('/api/users/me/external-apis', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.sub;
    console.log('External-APIs: decoded token for user:', userId);
    const { trading212ApiKey, binanceApiKey } = req.body;
    
    const updateData = {};
    if (trading212ApiKey !== undefined) updateData.trading212ApiKey = trading212ApiKey;
    if (binanceApiKey !== undefined) updateData.binanceApiKey = binanceApiKey;

    const user = await User.findByIdAndUpdate(
      userId, 
      { $set: updateData },
      { new: true }
    ).select('-password -passwordHash');

    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const userObj = user.toObject();
    userObj.hasTrading212ApiKey = !!user.trading212ApiKey;
    userObj.hasBinanceApiKey = !!user.binanceApiKey;
    
    res.json({ message: 'APIs atualizadas', profile: userObj });
  } catch (err) {
    console.error('External-APIs error:', err.message);
    res.status(401).json({ message: err.name === 'TokenExpiredError' ? 'Token expirado. Faz login novamente.' : 'Invalid token' });
  }
});

// Rota para atualizar dados financeiros
app.patch('/api/users/me/financial-data', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { netWorth, monthlyIncome, monthlyExpenses, etfPortfolio, realEstateValue, cryptoValue } = req.body;
    
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.financialProfile) {
      user.financialProfile = { history: [] };
    }

    if (netWorth !== undefined) user.financialProfile.netWorth = Number(netWorth);
    if (monthlyIncome !== undefined) user.financialProfile.monthlyIncome = Number(monthlyIncome);
    if (monthlyExpenses !== undefined) user.financialProfile.monthlyExpenses = Number(monthlyExpenses);
    if (etfPortfolio !== undefined) user.financialProfile.etfPortfolio = Number(etfPortfolio);
    if (realEstateValue !== undefined) user.financialProfile.realEstateValue = Number(realEstateValue);
    if (cryptoValue !== undefined) user.financialProfile.cryptoValue = Number(cryptoValue);

    user.markModified('financialProfile');

    // Adicionar ao histórico se o netWorth mudou significativamente ou se não houver histórico hoje
    const today = new Date().toISOString().split('T')[0];
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
    user.markModified('financialProfile.history');

    await user.save();
    res.json({ message: 'Dados financeiros atualizados', profile: user });
  } catch (err) {
    console.error('Update financial data error:', err);
    res.status(401).json({ message: 'Invalid token' });
  }
});

app.patch('/api/users/me/settings', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { salary, freelance, supermarket, electricity, steamEarnings } = req.body;
    
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.customSettings) {
      user.customSettings = {};
    }

    if (salary !== undefined) user.customSettings.salary = Number(salary);
    if (freelance !== undefined) user.customSettings.freelance = Number(freelance);
    if (supermarket !== undefined) user.customSettings.supermarket = Number(supermarket);
    if (electricity !== undefined) user.customSettings.electricity = Number(electricity);
    if (steamEarnings !== undefined) user.customSettings.steamEarnings = Number(steamEarnings);

    user.markModified('customSettings');

    await user.save();
    console.log('Successfully saved user settings to DB:', user.customSettings);
    res.json({ message: 'Definições atualizadas', profile: user });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(401).json({ message: 'Invalid token' });
  }
});

app.post('/api/users/me/real-estate', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { action, property, expense, propertyId, expenseId } = req.body;
    
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.realEstate) user.realEstate = [];

    if (action === 'addProperty') {
      const newProp = {
        name: property.name,
        dueDate: property.dueDate || 1,
        rentAmount: property.rentAmount || 0,
        typology: property.typology || 'T2',
        location: property.location || '',
        currentValue: property.currentValue || 0,
        status: property.status || 'Arrendado',
        contract: property.contract || {},
        credit: property.credit || {},
        expenses: property.expenses || []
      };
      user.realEstate.push(newProp);
    } else if (action === 'deleteProperty') {
      user.realEstate = user.realEstate.filter(r => r._id.toString() !== propertyId);
    } else if (action === 'addExpense') {
      const prop = user.realEstate.find(r => r._id.toString() === propertyId);
      if (prop) {
        prop.expenses.push({
          type: expense.type,
          amount: expense.amount,
          date: expense.date || new Date()
        });
      }
    } else if (action === 'deleteExpense') {
      const prop = user.realEstate.find(r => r._id.toString() === propertyId);
      if (prop) {
        prop.expenses = prop.expenses.filter(e => e._id.toString() !== expenseId);
      }
    }

    user.markModified('realEstate');
    await user.save();
    res.json({ message: 'Imóveis atualizados', profile: user });
  } catch (err) {
    console.error('Update real estate error:', err);
    res.status(401).json({ message: 'Invalid token' });
  }
});

app.get('/api/users/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log('No Authorization header found in request to:', req.url);
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.sub;
    const user = await User.findById(userId).select('-password -passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Convert to object and add computed properties
    const userObj = user.toObject();
    userObj.hasTrading212ApiKey = !!user.trading212ApiKey;
    userObj.hasBinanceApiKey = !!user.binanceApiKey;
    
    res.json({ profile: userObj });
  } catch (err) {
    console.error('JWT Verification Error:', err.message);
    res.status(401).json({ message: 'Invalid token' });
  }
});
const steamPriceCache = new Map();
let steamPriceBlockedUntil = 0;

const STEAM_PRICE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const STEAM_PRICE_STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STEAM_PRICE_LIVE_LIMIT = Number(process.env.STEAM_PRICE_LIVE_LIMIT || 20);
const STEAM_PRICE_DELAY_MS = Number(process.env.STEAM_PRICE_DELAY_MS || 1200);
const STEAM_GAMES = {
  cs2: { id: 'cs2', name: 'Counter-Strike 2', appId: 730, contextId: 2, stackDuplicates: false },
  rust: { id: 'rust', name: 'Rust', appId: 252490, contextId: 2, stackDuplicates: true },
  dota2: { id: 'dota2', name: 'Dota 2', appId: 570, contextId: 2, stackDuplicates: true },
  tf2: { id: 'tf2', name: 'Team Fortress 2', appId: 440, contextId: 2, stackDuplicates: true },
  unturned: { id: 'unturned', name: 'Unturned', appId: 304930, contextId: 2, stackDuplicates: true },
  payday2: { id: 'payday2', name: 'PAYDAY 2', appId: 218620, contextId: 2, stackDuplicates: true },
  banana: { id: 'banana', name: 'Banana', appId: 2923300, contextId: 2, stackDuplicates: true }
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getSteamGame(gameId = 'cs2') {
  return STEAM_GAMES[gameId] || STEAM_GAMES.cs2;
}

function getSteamPriceCacheKey(appId, name) {
  return `${appId}:${name}`;
}

function parseSteamMarketPrice(priceStr) {
  const cleaned = String(priceStr || '').replace(/&nbsp;/g, '').replace(/\s/g, '').replace(/[^\d.,]/g, '');
  if (!cleaned) return null;
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  const price = Number.parseFloat(normalized);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function getCachedSteamPrice(name, allowStale = false, appId = 730) {
  const cached = steamPriceCache.get(getSteamPriceCacheKey(appId, name));
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  const ttl = allowStale ? STEAM_PRICE_STALE_TTL_MS : STEAM_PRICE_CACHE_TTL_MS;
  if (age > ttl) return null;

  return {
    price: cached.price,
    stale: age > STEAM_PRICE_CACHE_TTL_MS
  };
}

function isSteamRateLimit(err) {
  return err?.response?.status === 429;
}

function markSteamPriceBlocked(err) {
  const retryAfter = Number(err?.response?.headers?.['retry-after'] || 0);
  const waitMs = retryAfter > 0 ? retryAfter * 1000 : 15 * 60 * 1000;
  steamPriceBlockedUntil = Date.now() + waitMs;
}

async function fetchSteamPrice(name, appId = 730) {
  if (Date.now() < steamPriceBlockedUntil) {
    const err = new Error('Steam price API is temporarily rate limited');
    err.rateLimited = true;
    throw err;
  }

  const priceUrl = `https://steamcommunity.com/market/priceoverview/?currency=3&appid=${appId}&market_hash_name=${encodeURIComponent(name)}`;
  const priceResponse = await axios.get(priceUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    timeout: 5000
  });

  if (!priceResponse.data || !priceResponse.data.success) return null;

  const priceStr = priceResponse.data.lowest_price || priceResponse.data.median_price || '0';
  const price = parseSteamMarketPrice(priceStr);
  if (price !== null) steamPriceCache.set(getSteamPriceCacheKey(appId, name), { price, timestamp: Date.now() });
  return price;
}

function shouldSkipSteamInventoryItem(desc) {
  const name = desc.market_hash_name || '';
  const type = desc.type || '';
  return !desc.tradable ||
    type.includes('Medal') ||
    type.includes('Badge') ||
    type.includes('Coin') ||
    type.includes('Charm') ||
    name.includes('Sealed Graffiti');
}

function getSteamPricePriority(desc) {
  const name = desc.market_hash_name || '';
  const type = desc.type || '';
  if (name.includes('Case') || name.includes('Terminal')) return 0;
  if (type.includes('Rifle') || type.includes('Pistol') || type.includes('SMG') || type.includes('Sniper') || type.includes('Shotgun')) return 1;
  if (name.includes('Sticker')) return 3;
  return 2;
}

function shouldStackSteamInventoryItem(desc) {
  const name = desc.market_hash_name || '';
  const type = desc.type || '';
  return name.includes('Case') ||
    name.includes('Capsule') ||
    name.includes('Sticker') ||
    name.includes('Graffiti') ||
    name.includes('Terminal') ||
    name.includes('Pass') ||
    type.includes('Container') ||
    type.includes('Sticker') ||
    type.includes('Graffiti');
}

app.get('/api/external/steam/price', async (req, res) => {
  const { name } = req.query;
  const game = getSteamGame(req.query.game);
  if (!name) return res.status(400).json({ message: 'Missing item name' });

  const cached = getCachedSteamPrice(name, false, game.appId);
  if (cached) {
    return res.json({ price: cached.price, source: cached.stale ? 'cache-stale' : 'cache' });
  }

  try {
    const price = await fetchSteamPrice(name, game.appId);
    return res.json({ price, source: price === null ? 'unavailable' : 'steam' });
  } catch (err) {
    if (isSteamRateLimit(err)) markSteamPriceBlocked(err);
    console.error('Steam Price Error for', name, ':', err.message);
    const stale = getCachedSteamPrice(name, true, game.appId);
    return res.json({
      price: stale?.price ?? null,
      source: stale ? 'cache-stale' : 'rate-limited',
      rateLimited: isSteamRateLimit(err) || err.rateLimited === true
    });
  }
});

app.get('/api/external/steam/price-legacy', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ message: 'Missing item name' });

  const cached = getCachedSteamPrice(name);
  if (cached) {
    return res.json({ price: cached.price, source: cached.stale ? 'cache-stale' : 'cache' });
  }

  try {
    const priceUrl = `https://steamcommunity.com/market/priceoverview/?currency=3&appid=730&market_hash_name=${encodeURIComponent(name)}`;
    const response = await axios.get(priceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 5000
    });

    if (response.data && response.data.success) {
      // Formata "36,41€" para 36.41
      const priceStr = response.data.lowest_price || response.data.median_price || "0";
      const rawPrice = parseFloat(priceStr.replace(/[^0-9,.]/g, '').replace(',', '.'));
      
      // Valor líquido (deduzindo a comissão de 15% da Steam)
      const price = rawPrice > 0 ? (rawPrice / 1.15) : 0;
      
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
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    const game = getSteamGame(req.query.game);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user || !user.steamId) {
      console.log('Steam inventory request failed: User has no Steam ID linked');
      return res.status(400).json({ message: 'User has no Steam ID linked' });
    }

    console.log('Fetching Steam inventory for user:', user.email, 'Steam ID:', user.steamId, 'Game:', game.name);

    // Voltar à API Community mas com Headers de Browser (evita bloqueios)
    const inventoryUrl = `https://steamcommunity.com/inventory/${user.steamId}/${game.appId}/${game.contextId}?l=portuguese&count=2000`;
    
    console.log('Fetching inventory from Community API for:', user.steamId, game.name);
    const response = await axios.get(inventoryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    if (!response.data || !response.data.descriptions) {
      console.log('No descriptions found in Steam response for user:', user.email, 'Game:', game.name);
      return res.json({ count: 0, items: [], game: game.id, gameName: game.name, appId: game.appId });
    }

    const assetCounts = new Map();
    const assetsByKey = new Map();
    const assets = Array.isArray(response.data.assets) ? response.data.assets : [];
    assets.forEach((asset) => {
      const key = `${asset.classid}_${asset.instanceid}`;
      assetCounts.set(key, (assetCounts.get(key) || 0) + Number(asset.amount || 1));
      const list = assetsByKey.get(key) || [];
      list.push(asset);
      assetsByKey.set(key, list);
    });

    console.log('Found', assets.length || response.data.descriptions.length, 'items in Steam inventory for user:', user.email);

    // Buscar precos por tipo de item e multiplicar pela quantidade real em assets.
    const items = [];
    const descriptions = [...response.data.descriptions].sort((a, b) => getSteamPricePriority(a) - getSteamPricePriority(b));
    const pricingStats = {
      liveFetched: 0,
      cached: 0,
      stale: 0,
      missing: 0,
      skipped: 0,
      rateLimited: false,
      liveLimit: STEAM_PRICE_LIVE_LIMIT,
      blockedUntil: null
    };
    
    console.log('Fetching prices for', descriptions.length, 'unique item types using Steam API');
    
    for (const desc of descriptions) {
      const assetKey = `${desc.classid}_${desc.instanceid}`;
      const quantity = assetCounts.get(assetKey) || 1;

      // Skip non-tradable items like medals, badges, etc.
      if (shouldSkipSteamInventoryItem(desc)) {
        console.log('Skipping non-tradable item:', desc.market_hash_name, 'Type:', desc.type);
        pricingStats.skipped++;
        items.push({
          name: desc.market_hash_name,
          icon: desc.icon_url ? `https://community.cloudflare.steamstatic.com/economy/image/${desc.icon_url}` : '',
          color: desc.name_color || 'ffffff',
          type: desc.type || 'Item',
          game: game.id,
          gameName: game.name,
          appId: game.appId,
          tradable: false,
          price: 0,
          unitPrice: 0,
          quantity,
          totalPrice: 0,
          priceSource: 'skipped'
        });
        continue;
      }

      let price = null;
      let priceSource = 'unpriced';
      const cachedPrice = getCachedSteamPrice(desc.market_hash_name, true, game.appId);

      if (cachedPrice) {
        price = cachedPrice.price;
        priceSource = cachedPrice.stale ? 'cache-stale' : 'cache';
        cachedPrice.stale ? pricingStats.stale++ : pricingStats.cached++;
        console.log('Using cached price for:', desc.market_hash_name, '-', price);
      } else if (!pricingStats.rateLimited && pricingStats.liveFetched < STEAM_PRICE_LIVE_LIMIT) {
        try {
          price = await fetchSteamPrice(desc.market_hash_name, game.appId);
          pricingStats.liveFetched++;
          if (price !== null) {
            priceSource = 'steam';
            console.log('Fetched price for:', desc.market_hash_name, '-', price);
          } else {
            console.log('Steam API returned success=false for:', desc.market_hash_name);
          }

          await sleep(STEAM_PRICE_DELAY_MS);
        } catch (priceErr) {
          if (isSteamRateLimit(priceErr)) {
            markSteamPriceBlocked(priceErr);
            pricingStats.rateLimited = true;
            pricingStats.blockedUntil = new Date(steamPriceBlockedUntil).toISOString();
          }
          console.error('Steam API error for item:', desc.market_hash_name, '-', priceErr.message);
          price = null;
          priceSource = pricingStats.rateLimited ? 'rate-limited' : 'unavailable';
        }
      } else {
        priceSource = pricingStats.rateLimited ? 'rate-limited' : 'live-limit';
      }

      if (price === null) pricingStats.missing++;
      const totalPrice = price === null ? null : price * quantity;
      const baseItem = {
        name: desc.market_hash_name,
        icon: desc.icon_url ? `https://community.cloudflare.steamstatic.com/economy/image/${desc.icon_url}` : '',
        color: desc.name_color || 'ffffff',
        type: desc.type || 'Item',
        game: game.id,
        gameName: game.name,
        appId: game.appId,
        tradable: desc.tradable,
        price: totalPrice,
        unitPrice: price,
        quantity,
        totalPrice,
        priceSource
      };

      const matchingAssets = assetsByKey.get(assetKey) || [];
      if (quantity > 1 && !game.stackDuplicates && !shouldStackSteamInventoryItem(desc) && matchingAssets.length > 1) {
        matchingAssets.forEach((asset, index) => {
          items.push({
            ...baseItem,
            assetId: asset.assetid,
            name: `${desc.market_hash_name} #${index + 1}`,
            baseName: desc.market_hash_name,
            price,
            totalPrice: price,
            quantity: 1,
            duplicateIndex: index + 1,
            duplicateTotal: matchingAssets.length
          });
        });
      } else {
        items.push(baseItem);
      }
    }

    console.log('Successfully fetched', items.length, 'items with prices for user:', user.email);

    res.json({
      count: response.data.total_inventory_count || assets.length || items.reduce((sum, item) => sum + (item.quantity || 1), 0),
      items: items,
      pricing: pricingStats,
      game: game.id,
      gameName: game.name,
      appId: game.appId
    });
  } catch (err) {
    console.error('Steam Inventory Error:', err.message);
    res.status(500).json({ message: 'Failed to fetch Steam inventory' });
  }
});

app.get('/api/external/trading212/portfolio', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.sub;
    const user = await User.findById(userId);
    
    if (!user || !user.trading212ApiKey) {
      return res.status(400).json({ message: 'User has no Trading 212 API Key linked' });
    }

    console.log('Fetching Trading 212 portfolio for user:', user.email);

    let response;
    try {
      response = await axios.get('https://live.trading212.com/api/v0/equity/account/cash', {
        headers: { 'Authorization': user.trading212ApiKey },
        timeout: 10000
      });
      console.log('Live T212 API success for user:', user.email);
    } catch (liveErr) {
      // Se falhar com 401 ou 403, pode ser uma chave de conta Prática (Demo)
      if (liveErr.response && (liveErr.response.status === 401 || liveErr.response.status === 403)) {
        console.log('Live T212 API failed, trying Demo API for user:', user.email);
        response = await axios.get('https://demo.trading212.com/api/v0/equity/account/cash', {
          headers: { 'Authorization': user.trading212ApiKey },
          timeout: 10000
        });
        console.log('Demo T212 API success for user:', user.email);
      } else {
        console.error('Live T212 API error (not 401/403):', liveErr.message);
        throw liveErr;
      }
    }

    if (!response || !response.data) {
      console.log('No response data from T212 API');
      return res.json({ success: false });
    }

    res.json({
      success: true,
      data: response.data
    });
  } catch (err) {
    console.error('Trading 212 API Error:', err.response?.data || err.message);
    res.status(500).json({ message: 'Failed to fetch Trading 212 data' });
  }
});

// ======================== FORUM ROUTES ========================

app.get('/api/forum', async (req, res) => {
  try {
    const posts = await ForumPost.find().sort({ createdAt: -1 }).limit(50);
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao carregar fórum' });
  }
});

app.post('/api/forum', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Não autorizado' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const newPost = new ForumPost({
      title: req.body.title,
      content: req.body.content,
      category: req.body.category,
      price: req.body.price,
      game: req.body.game || 'CS2',
      author: {
        id: user._id,
        name: user.displayName || user.name,
        avatar: user.avatar || ''
      }
    });

    await newPost.save();
    res.json({ message: 'Anúncio publicado com sucesso!', post: newPost });
  } catch (err) {
    console.error('Forum Post Error:', err);
    res.status(401).json({ message: 'Token inválido ou expirado' });
  }
});

app.delete('/api/forum/:id', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Não autorizado' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const post = await ForumPost.findById(req.params.id);
    
    if (!post) return res.status(404).json({ message: 'Post não encontrado' });
    
    // Apenas o autor ou admin pode apagar
    if (post.author.id.toString() !== decoded.id) {
      return res.status(403).json({ message: 'Sem permissão para apagar este anúncio' });
    }

    await ForumPost.findByIdAndDelete(req.params.id);
    res.json({ message: 'Anúncio removido' });
  } catch (err) {
    res.status(401).json({ message: 'Erro ao apagar' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'WealthSphere Backend is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`WealthSphere Backend running on port ${PORT}`);
});

