#!/usr/bin/env node

/**
 * Generate environment configuration files from environment variables
 * Run during build process to inject deployment-specific configuration
 * 
 * Usage: node generate-environment.js
 * 
 * Environment variables expected:
 * - API_URL: Backend API URL (default: http://localhost:5000/api)
 * - NODE_ENV: Environment (development/production)
 */

const fs = require('fs');
const path = require('path');

// Read environment variables
const apiUrl = process.env.API_URL || 'http://localhost:5000/api';
const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

// Environment configuration
const environmentConfig = `// This file is auto-generated. Do not edit manually.
export const environment = {
  production: ${isProduction},
  apiUrl: '${apiUrl}'
};
`;

// Path to environment file
const envFilePath = path.join(__dirname, '../frontend/src/environments/environment.ts');

// Ensure directory exists
const envDir = path.dirname(envFilePath);
if (!fs.existsSync(envDir)) {
  fs.mkdirSync(envDir, { recursive: true });
}

// Write environment file
fs.writeFileSync(envFilePath, environmentConfig, 'utf-8');

console.log(`✓ Generated environment.ts`);
console.log(`  API URL: ${apiUrl}`);
console.log(`  Production: ${isProduction}`);
