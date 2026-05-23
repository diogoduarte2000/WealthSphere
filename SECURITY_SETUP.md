# WealthSphere - Security Configuration Guide

## Overview
Este guia explica como configurar o projeto de forma segura usando variáveis de ambiente.

## Quick Start

### 1. Setup Local (Development)
```bash
# Copiar template
cp .env.example .env.local

# Editar com seus valores
nano .env.local
```

### 2. Variáveis Críticas de Segurança

#### `STEAM_TOKEN_POST_BODY` (CRÍTICO)
- **Development**: `false` (permite query string para testes)
- **Production**: `true` (obrigatório - POST body apenas)
- **Impacto**: Previne vazamento de token em logs, histórico, referrers

#### `AUTH_INTERCEPTOR_STRICT` (CRÍTICO)
- **Development**: `true` (recomendado)
- **Production**: `true` (obrigatório)
- **Impacto**: Previne vazamento de token para APIs externas

#### `TOKEN_REFRESH_ENABLED` (IMPORTANTE)
- **Development**: `true`
- **Production**: `true` (obrigatório)
- **Impacto**: Implementa refresh token flow seguro

### 3. Configurações por Ambiente

#### Development (.env.local)
```env
NODE_ENV=development
STEAM_TOKEN_POST_BODY=true
AUTH_INTERCEPTOR_STRICT=true
TOKEN_REFRESH_ENABLED=true
JWT_SECRET=dev-key-min-32-chars-here
SESSION_SECRET=dev-session-min-32-chars
```

#### Production (Render Dashboard)
```
NODE_ENV=production
STEAM_TOKEN_POST_BODY=true
AUTH_INTERCEPTOR_STRICT=true
TOKEN_REFRESH_ENABLED=true
JWT_SECRET=<gerar com: openssl rand -base64 32>
SESSION_SECRET=<gerar com: openssl rand -base64 32>
```

## Security Checklist

### Local Development
- [ ] Copiei `.env.example` para `.env.local`
- [ ] Preenchi `MONGO_URI` com meu servidor MongoDB
- [ ] `STEAM_TOKEN_POST_BODY=true` (recomendado mesmo em dev)
- [ ] `AUTH_INTERCEPTOR_STRICT=true`

### Production Deployment
- [ ] `NODE_ENV=production`
- [ ] Todos os secrets têm 64+ caracteres aleatórios
- [ ] `STEAM_TOKEN_POST_BODY=true` ✅ (obrigatório)
- [ ] `AUTH_INTERCEPTOR_STRICT=true` ✅ (obrigatório)
- [ ] `TOKEN_REFRESH_ENABLED=true` ✅ (obrigatório)
- [ ] HTTPS ativado em `SERVER_URL`
- [ ] `CLIENT_ORIGIN` contém apenas domínios permitidos
- [ ] `.env.local` **nunca** foi commitado
- [ ] Secrets foram gerados e nunca reutilizados

## Gerando Secrets Seguros

### Linux/Mac
```bash
# JWT_SECRET
openssl rand -base64 32

# SESSION_SECRET
openssl rand -base64 32
```

### Windows PowerShell
```powershell
# JWT_SECRET
[Convert]::ToBase64String([System.Security.Cryptography.RNGCryptoServiceProvider]::new().GetBytes(24))

# SESSION_SECRET
[Convert]::ToBase64String([System.Security.Cryptography.RNGCryptoServiceProvider]::new().GetBytes(24))
```

## Problemas Resolvidos

✅ **Steam Token em Query String** → Agora controlado por `STEAM_TOKEN_POST_BODY`
✅ **Auth Interceptor Vaza Token** → Agora controlado por `AUTH_INTERCEPTOR_STRICT`
✅ **Sem Refresh Token** → Agora habilitado por `TOKEN_REFRESH_ENABLED`

## Verificar Configuração em Runtime

```bash
# Backend (Node.js)
console.log(require('./config/security'));

# Verificar que está usando valores seguros
node -e "console.log({
  STEAM_TOKEN_POST_BODY: process.env.STEAM_TOKEN_POST_BODY,
  AUTH_INTERCEPTOR_STRICT: process.env.AUTH_INTERCEPTOR_STRICT,
  NODE_ENV: process.env.NODE_ENV
})"
```

## Deploy no Render

1. Ir a **Render Dashboard** → seu serviço backend
2. **Settings → Environment Variables**
3. Adicionar as variáveis (ver seção Production acima)
4. Deploy automático acontece quando git push é feito

---

**IMPORTANTE**: Nunca commite `.env.local` ou qualquer arquivo com secrets no git!
