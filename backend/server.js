const express = require('express');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const session = require('express-session');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'wealthsphere-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

// Steam Strategy
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

passport.use(new SteamStrategy({
  returnURL: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/auth/steam/return`,
  realm: process.env.BACKEND_URL || 'http://localhost:3000',
  apiKey: process.env.STEAM_API_KEY
},
  (identifier, profile, done) => {
    // Aqui você pode salvar/actualizar o utilizador na base de dados
    return done(null, profile);
  }
));

// Routes
app.get('/api/auth/steam', passport.authenticate('steam'), (req, res) => {
  // Steam authentication initiated
});

app.get('/api/auth/steam/return', 
  passport.authenticate('steam', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/auth?steamId=${req.user.id}`);
  }
);

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  // TODO: Implementar autenticação real com base de dados
  if (email && password) {
    res.json({
      message: 'Login successful',
      user: { id: '1', name: 'User', email: email },
      tokens: { accessToken: 'mock_token', refreshToken: 'mock_refresh' }
    });
  } else {
    res.status(400).json({ message: 'Email and password required' });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  // TODO: Implementar registo real com base de dados
  if (name && email && password) {
    res.json({
      message: 'Registration successful',
      user: { id: '1', name: name, email: email },
      tokens: { accessToken: 'mock_token', refreshToken: 'mock_refresh' }
    });
  } else {
    res.status(400).json({ message: 'Name, email and password required' });
  }
});

app.get('/api/user', (req, res) => {
  if (req.user) {
    res.json(req.user);
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'WealthSphere Backend is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`WealthSphere Backend running on port ${PORT}`);
});
