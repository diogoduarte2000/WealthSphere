const express = require('express');
const cors = require('cors');

const env = require('./src/config/env');
const apiRouter = require('./src/routes');
const { notFoundHandler, errorHandler } = require('./src/middleware/errorHandler');

const app = express();
const allowCredentials = env.clientOrigin !== '*' && !env.clientOrigin.includes?.('*');

app.use(cors({
  origin: env.clientOrigin,
  credentials: allowCredentials
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
