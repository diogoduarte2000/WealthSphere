const express = require('express');
const cors = require('cors');

const env = require('./src/config/env');
const apiRouter = require('./src/routes');
const { notFoundHandler, errorHandler } = require('./src/middleware/errorHandler');

const session = require('express-session');
const passport = require('./src/config/passport');

const app = express();
const allowCredentials = env.clientOrigin !== '*' && !env.clientOrigin.includes?.('*');

// SESSÕES (Necessário para o Steam OpenID)
app.use(session({
  secret: env.jwtSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: env.nodeEnv === 'production' }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(cors({
  origin: env.clientOrigin,
  credentials: true // Steam OpenID precisa de cookies/sessão
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req, res) => {
  res.json({
    name: 'WealthSphere API',
    status: 'online',
    docs: '/api/health'
  });
});

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
