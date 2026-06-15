# Configuração de Ambientes - WealthSphere

## Arquitetura

Este projeto usa um sistema de ambientes flexível que permite trabalhar localmente sem mexer em configs para deploy.

### Fluxo

```
Local Development:
  .env.local → process.env → Node.js

Frontend Build:
  generate-environment.js → lê process.env → escreve environment.ts

Deploy (Render/Vercel):
  Environment Variables (dashboard) → build process → código final
```

---

## 🏠 Desenvolvimento Local

### 1️⃣ Setup Inicial

```bash
# Copiar arquivo de exemplo
cp .env.example .env.local

# Editar com seus valores
# - Mongo URI local
# - Steam API key (opcional)
# - URLs locais
```

### 2️⃣ Backend (Node.js + Render/Vercel)

```bash
cd backend
npm install
npm run dev
```

Variáveis lidas automaticamente de `.env.local`:
- `PORT` → server escuta na porta
- `MONGO_URI` → conexão ao banco
- `JWT_SECRET`, `SESSION_SECRET` → autenticação
- `STEAM_API_KEY` → API do Steam
- `CLIENT_ORIGIN` → CORS

### 3️⃣ Frontend (Angular)

```bash
cd frontend
npm install
npm start
```

O Angular serve com `http://localhost:4200` e conecta ao backend em `http://localhost:5000/api`

---

## 🚀 Deploy (Sem mexer em código!)

### Render (Backend)

1. Conectar repositório no Render
2. Ir para **Environment Variables** no dashboard
3. Adicionar as variáveis EXATAMENTE como estão em `render.yaml`:

```yaml
PORT=3000
NODE_ENV=production
MONGO_URI=mongodb+srv://... (sua MongoDB Atlas URI)
JWT_SECRET=algo-super-secreto
SESSION_SECRET=outro-super-secreto
STEAM_API_KEY=sua-api-key
SERVER_URL=https://wealthsphere-backend.onrender.com
FRONTEND_URL=https://seu-dominio.vercel.app
CLIENT_ORIGIN=https://seu-dominio.vercel.app,https://outro-dominio.vercel.app
```

4. Render faz deploy automático → server.js lê `process.env`

### Vercel (Frontend)

1. Conectar repositório no Vercel
2. Ir para **Settings → Environment Variables**
3. Adicionar apenas:

```
API_URL=https://wealthsphere-backend.onrender.com/api
NODE_ENV=production
```

4. Vercel faz deploy automático:
   - Executa `prebuild` → `node generate-environment.js`
   - Gera environment.ts com `API_URL` da env var
   - Compila Angular e faz upload

---

## 📝 Como Funciona

### Backend (`server.js`)

```javascript
require('dotenv').config(); // Lê .env.local em dev

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
// etc...
```

Sem mudanças! Em dev lê `.env.local`, em prod lê as vars do Render.

### Frontend (`frontend/package.json`)

```json
"prebuild": "node ../generate-environment.js"
```

Antes de compilar, o script:
- Lê `process.env.API_URL` (de `.env` em dev, de Vercel em prod)
- Gera `src/environments/environment.ts` dinamicamente
- Angular usa esse arquivo

---

## ✅ Checklist Deploy

### Antes de fazer Deploy

- [ ] `.env.local` criado e preenchido (NÃO fazer commit!)
- [ ] Testes locais passam
- [ ] Backend funciona em `localhost:5000`
- [ ] Frontend funciona em `localhost:4200`

### No Render (Backend)

- [ ] Variáveis de ambiente configuradas no dashboard
- [ ] Deploy automático ativado
- [ ] Logs mostram "Connected to Main Database"

### No Vercel (Frontend)

- [ ] Variáveis de ambiente configuradas (`API_URL`, `NODE_ENV`)
- [ ] Deploy automático ativado
- [ ] Build logs mostram "✓ Generated environment.ts"

---

## 🔄 Workflow Normal (Sem Mexer em Configs)

1. **Fazer mudanças no código**
   ```bash
   git add .
   git commit -m "Feature X"
   git push origin main
   ```

2. **Render faz deploy automático**
   - Lê vars de ambiente do dashboard
   - Compila e sobe

3. **Vercel faz deploy automático**
   - Lê vars de ambiente do dashboard
   - Executa `prebuild` para gerar environment.ts
   - Compila Angular e sobe

**Resultado:** Código novo em produção, sem nunca mexer em configs! ✨

---

## 🐛 Troubleshooting

### "API connection refused"
→ Verificar `API_URL` em Vercel é correto

### "Database connection failed"
→ Verificar `MONGO_URI` em Render é válida

### "CORS error"
→ Verificar `CLIENT_ORIGIN` em Render lista todos os domínios do Vercel

### Build falha em Vercel
→ Verificar se `generate-environment.js` está na raiz do projeto

---

## 📚 Arquivos Importantes

- `.env.local` → Seu local dev (não commitar!)
- `.env.example` → Template para novos devs
- `generate-environment.js` → Script que injeta vars no build
- `render.yaml` → Config do Render (não precisa editar!)
- `vercel.json` → Config do Vercel (não precisa editar!)
- `frontend/src/environments/` → Auto-gerado em build
