const express = require('express');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const session = require('express-session');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(cors({
  origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : 'http://localhost:4200',
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
    const user = await User.findById(decoded.id);
    if (user) {
      user.steamId = undefined;
      // Poderíamos remover displayName/avatar se não forem do login normal
      await user.save();
      return res.json({ message: 'Steam account unlinked successfully' });
    }
    res.status(404).json({ message: 'User not found' });
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
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

    user.financialProfile = {
      ...user.financialProfile,
      netWorth: netWorth ?? user.financialProfile.netWorth,
      monthlyIncome: monthlyIncome ?? user.financialProfile.monthlyIncome,
      monthlyExpenses: monthlyExpenses ?? user.financialProfile.monthlyExpenses,
      etfPortfolio: etfPortfolio ?? user.financialProfile.etfPortfolio,
      realEstateValue: realEstateValue ?? user.financialProfile.realEstateValue,
      cryptoValue: cryptoValue ?? user.financialProfile.cryptoValue
    };

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

    await user.save();
    res.json({ message: 'Dados financeiros atualizados', profile: user });
  } catch (err) {
    console.error('Update financial data error:', err);
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
    const user = await User.findById(decoded.id);
    res.json({ profile: user });
  } catch (err) {
    console.error('JWT Verification Error:', err.message);
    res.status(401).json({ message: 'Invalid token' });
  }
});

app.get('/api/external/steam/inventory', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user || !user.steamId) {
      return res.status(400).json({ message: 'User has no Steam ID linked' });
    }

    // CS2 appid is 730, contextid is 2
    const inventoryUrl = `https://steamcommunity.com/inventory/${user.steamId}/730/2?l=portuguese&count=5000`;
    
    const response = await axios.get(inventoryUrl);
    
    // Processar inventário básico para o frontend
    const items = response.data.descriptions.map(desc => ({
      name: desc.market_hash_name,
      icon: `https://community.cloudflare.steamstatic.com/economy/image/${desc.icon_url}`,
      color: desc.name_color,
      type: desc.type
    }));

    res.json({
      count: response.data.total_inventory_count,
      items: items.slice(0, 50) // Limitar para o demo
    });
  } catch (err) {
    console.error('Steam Inventory Error:', err.message);
    res.status(500).json({ message: 'Failed to fetch Steam inventory' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'WealthSphere Backend is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`WealthSphere Backend running on port ${PORT}`);
});

