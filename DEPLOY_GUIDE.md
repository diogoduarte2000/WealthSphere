# Quick Reference - Deploy Sem Mexer em Configs

## 🎯 Objetivo
Trabalha localmente com `.env.local` → Faz deploy → Tudo funciona sem editar código/configs

---

## 📋 Setup One-Time (primeira vez)

### Local
```bash
# 1. Copiar arquivo template
cp .env.example .env.local

# 2. Editar .env.local com seus valores
nano .env.local
# Preencheres:
# - MONGO_URI (local ou MongoDB Atlas)
# - STEAM_API_KEY (opcional)
# - Resto deixa como está

# 3. Pronto! Backend e Frontend funcionam
cd backend && npm run dev    # Terminal 1
cd frontend && npm start     # Terminal 2
```

### Render Dashboard (primeira vez)
1. Ir a Render.com → seu service backend
2. **Settings → Environment Variables**
3. Clicar "Add Environment Variable" e adicionar:
   - `PORT` = `3000`
   - `NODE_ENV` = `production`
   - `MONGO_URI` = `sua-mongo-atlas-uri`
   - `JWT_SECRET` = `algo-super-secreto`
   - `SESSION_SECRET` = `outro-super-secreto`
   - `STEAM_API_KEY` = `sua-api-key`
   - `SERVER_URL` = `https://seu-backend-render.onrender.com`
   - `FRONTEND_URL` = `https://seu-frontend-vercel.app`
   - `CLIENT_ORIGIN` = `https://seu-frontend-vercel.app`

### Vercel Dashboard (primeira vez)
1. Ir a Vercel → seu projeto frontend
2. **Settings → Environment Variables**
3. Adicionar:
   - `API_URL` = `https://seu-backend-render.onrender.com/api`
   - `NODE_ENV` = `production`

---

## 🚀 Deploy (depois de setup)

### Workflow Normal
```bash
# 1. Fazer mudanças
git add .
git commit -m "Your changes"
git push origin main

# 2. Render faz deploy automático ✅
# 3. Vercel faz deploy automático ✅
```

**Nada mais!** Ambos lêem vars de ambiente do dashboard.

---

## ✅ Verificar se funciona

### Local
```bash
# Terminal 1 - Backend deve ligar
cd backend && npm run dev
# Esperar por "Connected to Main Database"

# Terminal 2 - Frontend deve servir
cd frontend && npm start
# Abrir http://localhost:4200
# Deve conseguir fazer login/sync Steam
```

### Produção
1. Ir a `https://seu-app.vercel.app`
2. Fazer login
3. Sync Steam deve funcionar
4. Se houver erro, verificar logs em Render/Vercel

---

## 🔒 Importante - Segurança

✅ `.env.local` está em `.gitignore` → não sobe para git  
✅ Secrets (JWT_SECRET, etc) apenas no Render dashboard  
✅ Frontend não precisa de secrets  

---

## 📞 Problemas Comuns

| Problema | Solução |
|----------|---------|
| "API connection refused" | Verificar `API_URL` em Vercel settings |
| "Database error" | Verificar `MONGO_URI` em Render settings |
| "CORS error" | Adicionar domínio em `CLIENT_ORIGIN` Render |
| "Build falha Vercel" | Logs → buscar "Generated environment.ts" |

---

## 📖 Mais Info
Ver `CONFIG_ENVS.md` para detalhes técnicos completos
