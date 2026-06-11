const dotenv = require('dotenv');

dotenv.config();

function parseOrigins(value) {
  if (!value || value === '*') {
    return '*';
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/wealthsphere',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  accessTokenTtl: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenTtl: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  clientOrigin: parseOrigins(process.env.CLIENT_ORIGIN || '*')
};

module.exports = env;
