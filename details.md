# WealthSphere — Prompt Completo de Desenvolvimento
> Versão definitiva · Para uso com AI no VS Code (Copilot, Cursor, Windsurf, etc.)
> O AI tem acesso ao projeto completo — referencia ficheiros existentes sempre que possível.

---

## 🧠 CONTEXTO GERAL

Estás a desenvolver o **WealthSphere**, uma plataforma web full-stack de gestão financeira pessoal, mercados financeiros e comunidade. O projeto já tem estrutura base em Angular 17 (frontend) e Node.js/Express (backend). Consulta os ficheiros existentes antes de criar novos.

**Missão:** Ser a plataforma financeira mais completa para o mercado português — combinando ferramentas profissionais de finanças, dados de mercado em tempo real, mercados alternativos (CS2/Steam) e uma comunidade ativa.

**Público-alvo:** Investidores individuais, proprietários de imóveis, responsáveis de crédito, banqueiros, traders de skins, jovens que começam a investir.

---

## 🏗️ STACK TÉCNICO COMPLETO

### Frontend
- **Framework:** Angular 17+ (standalone components, signals, lazy loading por módulo)
- **Styling:** SCSS com variáveis CSS globais
- **HTTP:** Angular HttpClient com interceptors (auth + error handling)
- **State:** Angular Signals + RxJS
- **Charts:** Chart.js 4 (já instalado ou instalar)
- **Real-time:** Socket.io client
- **Icons:** Lucide Angular ou SVG inline
- **Forms:** Angular Reactive Forms com validação

### Backend
- **Runtime:** Node.js 20+
- **Framework:** Express.js
- **Base de dados:** MongoDB Atlas com Mongoose ODM
- **Auth:** JWT (access token 15min + refresh token 7d) + bcrypt
- **Real-time:** Socket.io
- **Cache:** Redis (taxas financeiras, preços Steam — TTL 5min)
- **Email:** Nodemailer + SendGrid (alertas, boas-vindas)
- **Upload:** Multer (avatares, CSVs de portfólio)
- **Validação:** Joi ou Zod
- **Logs:** Winston

### Deploy
- **Frontend:** Vercel (build: `npx ng build --configuration production`, output: `dist/frontend/browser`)
- **Backend:** Render.com (Node.js service)
- **DB:** MongoDB Atlas (M0 free tier)
- **Cache:** Redis Cloud (free tier)
- **Variáveis de ambiente:** `.env` com dotenv

### APIs Externas
```
ECB Statistical Data Warehouse → Euribor histórico e atual
  URL: https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.RT0.BB.R.1.{TENOR}.R.A

Banco de Portugal → TEAG, taxas bancárias
  URL: https://www.bportugal.pt/api

Alpha Vantage → Ações, ETFs, câmbios (API key gratuita)
  URL: https://www.alphavantage.co/query

CoinGecko → Cripto (sem API key para básico)
  URL: https://api.coingecko.com/api/v3

Steam Market → Preços de itens CS2/Dota2/etc
  URL: https://steamcommunity.com/market/priceoverview/?appid={APP_ID}&market_hash_name={ITEM}&currency=3
  Histórico: https://steamcommunity.com/market/pricehistory/?appid={APP_ID}&market_hash_name={ITEM}

Steam Web API → Inventários, perfis (API key gratuita em steamcommunity.com/dev/apikey)
  URL: https://api.steampowered.com/IEconItems_730/GetPlayerItems/v1/?key={KEY}&steamid={ID}

Steam OpenID → Autenticação Steam
  Biblioteca: passport-steam (npm)

CSFloat API → Float de skins, detalhes avançados
  URL: https://csfloat.com/api/v1

Skinport API → Preços alternativos CS2
  URL: https://api.skinport.com/v1/items?app_id=730

Trading 212 API (beta) → Portfólio, posições
  URL: https://live.trading212.com/api/v0 (necessita API key do user)

INE Portugal → Índice de atualização de rendas
  URL: https://www.ine.pt/xportal/xmain?xpid=INE&xpgid=ine_indicadores
```

---

## 🗄️ MODELOS DE BASE DE DADOS (MONGOOSE)

```javascript
// User
{
  _id, name, email, passwordHash, avatar, bio, location,
  role: ['user','moderator','admin'],
  plan: ['free','pro'],
  steamId, steamProfile,
  trading212Key,        // encriptado AES-256
  tradeRepublicConnected: Boolean,
  preferences: { currency, language, theme, timezone, dateFormat, numberFormat },
  notifications: { euribor, euriborThreshold, stockPrice, skinPrice, forumReplies, forumMentions, weeklyEmail },
  privacy: { portfolioPublic, netWorthVisible, showInLeaderboard },
  reputation: Number,
  createdAt, updatedAt
}

// Income
{
  _id, userId,
  type: ['salary','rent','freelance','dividend','other'],
  amount, currency, description, category,
  date, recurring: Boolean, recurringDay: Number,
  createdAt
}

// Expense
{
  _id, userId, amount, category, description,
  date, recurring: Boolean, budget: Number,
  createdAt
}

// Property (Imóvel)
{
  _id, userId, name,
  type: ['apartment','house','commercial'],
  location, area, purchasePrice, currentValue, purchaseDate,
  mortgage: { bank, capital, rate, spread, term, startDate },
  monthlyCondoFee, annualIMI, annualInsurance,
  createdAt
}

// Rent (Renda)
{
  _id, propertyId, userId,
  amount, tenant, startDate, endDate,
  paid: Boolean, paidDate,
  ineIndex: Number,
  createdAt
}

// Portfolio (ETF/Ações)
{
  _id, userId, ticker, name, quantity, avgPrice,
  assetType: ['etf','stock','crypto','bond'],
  exchange, currency,
  createdAt
}

// SteamItem
{
  _id, userId, assetId, classId, marketHashName,
  appId, name, rarity, wear, float,
  purchasePrice, createdAt
}

// Simulation (guardada)
{
  _id, userId, type, name,
  params: Object, result: Object,
  createdAt
}

// Alert
{
  _id, userId,
  type: ['euribor','stock','skin','news'],
  asset, condition: ['above','below'],
  targetValue, triggered: Boolean, triggeredAt,
  active: Boolean, createdAt
}

// WatchlistItem
{
  _id, userId,
  assetType: ['stock','etf','crypto','skin'],
  assetId, name, targetPrice, notes,
  createdAt
}

// Post (Fórum)
{
  _id, authorId, title, body,
  tags: [String],
  upvotes: [userId], downvotes: [userId],
  views: Number, pinned: Boolean, locked: Boolean,
  createdAt, updatedAt
}

// Comment
{
  _id, postId, parentId, authorId, body,
  upvotes: [userId],
  createdAt
}

// Goal (Meta)
{
  _id, userId, name, emoji,
  targetAmount, currentAmount,
  deadline, category,
  createdAt
}
```

---

## 🔐 AUTENTICAÇÃO & INTEGRAÇÕES

### Auth Local
```
POST /api/auth/register  → { name, email, password } → JWT + refreshToken
POST /api/auth/login     → { email, password } → JWT + refreshToken
POST /api/auth/refresh   → { refreshToken } → novo JWT
POST /api/auth/logout    → blacklist refreshToken
GET  /api/auth/me        → perfil do user autenticado
```

### Steam OpenID
```javascript
// npm install passport passport-steam express-session
// Fluxo:
// 1. GET /api/auth/steam → redireciona para Steam
// 2. Steam autentica → callback GET /api/auth/steam/callback
// 3. Recebe steamID64 → guardar no User
// 4. Redirecionar para /dashboard com token

const SteamStrategy = require('passport-steam').Strategy;
passport.use(new SteamStrategy({
  returnURL: process.env.BASE_URL + '/api/auth/steam/callback',
  realm: process.env.BASE_URL,
  apiKey: process.env.STEAM_API_KEY
}, async (identifier, profile, done) => {
  const steamId = profile.id;
  await User.findByIdAndUpdate(req.user._id, {
    steamId,
    steamProfile: profile
  });
  return done(null, profile);
}));
```

### Trading 212
```javascript
// User introduz API key (gerada em Trading 212 → Definições → API)
// Guardar encriptada com AES-256 no backend
// Nunca expor a key ao frontend — backend faz proxy

GET https://live.trading212.com/api/v0/equity/portfolio
  Headers: { Authorization: apiKey }
  // Retorna: posições abertas com ticker, quantity, currentPrice, ppl

GET https://live.trading212.com/api/v0/equity/history/orders
  // Retorna: histórico de ordens

// Rotas proxy no backend:
GET /api/integrations/trading212/portfolio
GET /api/integrations/trading212/history
POST /api/integrations/trading212/sync
```

### Trade Republic
```javascript
// Sem API oficial — solução MVP: upload CSV/PDF
// 1. User exporta extrato em Trade Republic
// 2. POST /api/integrations/traderepublic/import (multipart/form-data)
// 3. Backend faz parse com pdf-parse ou csv-parser
// 4. Mapeia para Portfolio model

// Colunas típicas CSV Trade Republic:
// Date, Type, Name, ISIN, Shares, Price, Amount, Currency
```

---

## 📁 ESTRUTURA DE PASTAS ANGULAR

```
frontend/src/
├── app/
│   ├── core/
│   │   ├── guards/
│   │   │   ├── auth.guard.ts
│   │   │   └── demo.guard.ts
│   │   ├── interceptors/
│   │   │   ├── auth.interceptor.ts      → adiciona Bearer token
│   │   │   └── error.interceptor.ts     → trata 401/403/500
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── user.service.ts
│   │   │   ├── market.service.ts        → taxas, ações, cripto
│   │   │   ├── steam.service.ts         → inventário, preços
│   │   │   ├── socket.service.ts        → Socket.io wrapper
│   │   │   └── alert.service.ts
│   │   └── utils/
│   │       └── financial.utils.ts       → todas as fórmulas financeiras
│   ├── shared/
│   │   ├── components/
│   │   │   ├── sidebar/
│   │   │   ├── topbar/
│   │   │   ├── stat-card/
│   │   │   ├── chart-card/
│   │   │   ├── modal/
│   │   │   └── empty-state/
│   │   └── pipes/
│   │       ├── currency-pt.pipe.ts
│   │       └── percent.pipe.ts
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── income/
│   │   ├── simulator/           → ver módulos abaixo
│   │   ├── properties/          → rendas e imóveis
│   │   ├── markets/             → taxas, ações, ETFs, cripto
│   │   ├── steam/               → CS2 & Steam
│   │   ├── community/           → fórum, posts, comentários
│   │   ├── profile/
│   │   └── settings/
│   └── app.routes.ts            → lazy loading por feature
├── environments/
│   ├── environment.ts
│   └── environment.prod.ts
└── styles/
    ├── _variables.scss
    ├── _components.scss
    └── styles.scss
```

---

## ⚙️ DEFINIÇÕES (Settings Page)

Implementar `/settings` com 5 secções em tabs:

### 1. Conta & Perfil
- Inputs: Nome, Username, Bio, Localização
- Upload de avatar (Multer)
- Alterar email (com verificação)
- Botão: Alterar password (modal)
- Danger zone: Eliminar conta

### 2. Notificações
```typescript
interface NotificationSettings {
  euriborAlert: boolean;
  euriborThreshold: number;      // ex: 2.50%
  stockPriceAlert: boolean;
  skinPriceAlert: boolean;
  forumReplies: boolean;
  forumMentions: boolean;
  weeklyEmailSummary: boolean;
  marketOpenAlert: boolean;
}
```

### 3. Integrações
```
Steam
  → Estado: avatar + nome + steamID se conectado
  → Botão "Conectar Steam" → /api/auth/steam
  → Botão "Desconectar" → remove steamId
  → Última sincronização

Trading 212
  → Input: API Key (type password)
  → Botão "Verificar e Guardar"
  → Estado: "Conectado · última sync há 5min" ou erro
  → Botão "Sincronizar agora"

Trade Republic
  → Upload de CSV ou PDF
  → Histórico de imports
  → Botão "Importar extrato"
```

### 4. Preferências
```typescript
interface Preferences {
  currency: 'EUR' | 'USD' | 'GBP';
  language: 'pt' | 'en';
  theme: 'light' | 'dark' | 'system';
  timezone: string;           // 'Europe/Lisbon'
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY';
  numberFormat: 'pt' | 'en'; // 1.000,00 vs 1,000.00
}
```

### 5. Privacidade & RGPD
- Toggle: Portfólio público/privado
- Toggle: Net worth visível no perfil
- Toggle: Aparecer em leaderboards
- Botão: Exportar todos os dados (JSON/CSV)
- Botão: Eliminar todos os dados (RGPD Art. 17)

---

## 📊 MÓDULO SIMULADOR — FÓRMULAS COMPLETAS

Implementar em `financial.utils.ts` como pure functions. UI com tabs, inputs reactivos (onChange → resultado imediato), gráficos Chart.js.

---

### TAB 1 — Juros: Simples, Composto e Taxas

```typescript
// JURO SIMPLES
// M = C × (1 + i × n)
// Inputs: Capital (C), Taxa anual (i em %), Período em anos (n)
// Output: Montante final, Juros ganhos, tabela anual

// JURO COMPOSTO
// M = C × (1 + i/m)^(n×m)
// m = frequência capitalização: 1(anual) | 2(semestral) | 4(trimestral) | 12(mensal) | 365(diária)
// Output: Montante, Juros, comparação com juro simples no mesmo gráfico

// CAPITALIZAÇÃO CONTÍNUA
// M = C × e^(i×n)
// Output: gráfico comparativo das 3 modalidades

// CONVERSÃO DE TAXAS
// Taxa nominal → Taxa efetiva:    i_ef = (1 + i_nom/m)^m - 1
// Taxa efetiva → Taxa mensal eq.: i_m  = (1 + i_a)^(1/12) - 1
// Taxa real:                      i_real = (1 + i_nom) / (1 + inflação) - 1
// APY vs APR:                     APY  = (1 + APR/n)^n - 1

// DESCONTO
// Comercial (por fora): D = N × d × t / 100
// Racional (por dentro): D = N × i × t / (1 + i × t)
// Inputs: Valor nominal (N), taxa de desconto (d), tempo (t em anos)
```

---

### TAB 2 — Investimento & Poupança

```typescript
// DCA — Dollar Cost Averaging com depósito mensal
// M = C×(1+i_m)^n + PMT×[(1+i_m)^n - 1]/i_m
// i_m = taxa mensal = (1 + i_a)^(1/12) - 1
// Output: total investido, juros gerados, gráfico empilhado capital vs juros

// COMPARADOR DE CENÁRIOS (até 3 lado a lado)
// Cada cenário: nome, taxa anual, tipo (ETF/Depósito/Imóvel/Cripto)
// Output: gráfico multi-linha, tabela comparativa, diferença em €

// CALCULADORA FIRE
// FIRE Number = Despesas anuais desejadas × 25   (SWR 4%)
// Anos até FIRE: iteração até portfólio >= FIRE Number
// Inputs: despesas anuais desejadas, poupança atual, poupança mensal,
//         taxa de retorno, taxa de inflação, idade atual
// Output: FIRE Number, anos até FIRE, idade de reforma, gráfico de progresso

// SIMULADOR DE DIVIDENDOS
// Inputs: capital, yield anual (%), crescimento anual do dividendo (%),
//         DRIP (reinvestir: sim/não), período em anos
// Output: dividendos totais recebidos, capital final,
//         rendimento mensal sustentável na reforma

// IMPACTO DA INFLAÇÃO
// Poder de compra: P = C / (1 + inflação)^n
// Inputs: valor atual em €, taxa de inflação, período
// Output: "€1.000 hoje valem €X em N anos", gráfico de erosão

// TER — Custo do Fundo
// Inputs: capital, retorno bruto anual, TER_A (ex:0.07%), TER_B (ex:0.50%), período
// Output: diferença em € ao longo do tempo, "o custo do TER"

// RETORNO HISTÓRICO SIMULADO
// Inputs: índice (S&P500/NASDAQ/PSI20/VWCE), ano de início, capital
// Usar dados estáticos dos últimos 30 anos (hardcoded array de retornos anuais)
// Output: "Se investisses €X em {índice} em {ano}, hoje terias €Y"
```

---

### TAB 3 — Crédito Habitação

```typescript
// SIMULADOR PRINCIPAL (Tabela Francesa)
// PMT = C × [i_m(1+i_m)^n] / [(1+i_m)^n - 1]
// i_m = (Euribor + spread) / 12
// Inputs: valor imóvel, entrada (%), capital, prazo (anos),
//         tipo (fixa/variável), spread (%), Euribor (auto-preenchido da API)
// TAEG = inclui spread + comissões anuais
// Output: prestação mensal, custo total, total juros,
//         tabela de amortização mês a mês (capital pago, juros, capital em dívida)

// COMPARADOR DE BANCOS
// Mesmas condições, comparar 3 bancos com spreads diferentes
// Spreads PT de referência 2025:
//   CGD: ~0.85% | BCP: ~0.90% | Santander: ~0.80% | BPI: ~0.85% | Novobanco: ~0.95%
// Output: tabela — prestação mensal, custo total, diferença vs melhor proposta

// IMPACTO DA SUBIDA DE EURIBOR
// Inputs: capital em dívida, prazo restante (meses), spread atual
// Simular: Euribor atual | +0.5% | +1% | +1.5% | +2%
// Output: nova prestação por cenário, aumento mensal, aumento anual

// AMORTIZAÇÃO ANTECIPADA
// Inputs: capital em dívida, prazo restante, taxa atual, valor a amortizar
// Opção A: reduzir prestação (mesmo prazo)
// Opção B: reduzir prazo (mesma prestação)
// Output: poupança em juros para cada opção, nova prestação/prazo, gráfico antes/depois

// LTV — Loan to Value
// LTV = Capital Emprestado / Valor Imóvel × 100
// Limites PT: 80% hab. própria | 90% jovens ≤35 anos | 100% imóveis banco
// Output: LTV atual, semáforo (verde/amarelo/vermelho), quanto falta para baixar de tier

// RÁCIO DE ESFORÇO
// RE = Σ(prestações mensais) / Rendimento líquido mensal × 100
// Limite recomendado Banco de Portugal: 35%
// Output: RE atual, capacidade restante, aprovação estimada

// DSTI — Debt Service to Income
// DSTI = Σ(serviço anual da dívida) / Rendimento bruto anual × 100

// STRESS TEST BCE
// Calcular com taxa atual E com taxa + 3%
// Output: "O banco aprova se conseguires pagar €X/mês no cenário adverso"

// BUY vs RENT
// Inputs: valor imóvel, entrada, taxa crédito, prazo,
//         renda alternativa mensal, valorização anual do imóvel (%),
//         retorno alternativo do capital se investido (%)
// Output: ponto de equilíbrio em anos, gráfico wealth (comprar vs arrendar)

// REFINANCIAMENTO / TRANSFERÊNCIA
// Inputs: crédito atual (taxa, prazo restante, capital em dívida),
//         nova proposta (taxa, comissões de transferência ~€500-1500)
// Break-even = Custos transferência / Poupança mensal
// Output: poupança mensal, meses para break-even, poupança total até fim do prazo
```

---

### TAB 4 — Rendas & Imóveis

```typescript
// ATUALIZAÇÃO DE RENDA — INE
// Simples (1 ano):    Nova renda = Renda atual × (1 + coef_INE/100)
// Composta (N anos):  Nova renda = Renda inicial × Π(1 + coef_i/100)
// Inputs: renda atual, ano(s) de atualização
// Coeficientes INE históricos (hardcoded):
//   2025: +2.16% | 2024: +6.94% | 2023: +2.00% | 2022: +0.43% | 2021: +0.37%
// Output: nova renda, aumento em €, tabela histórica de atualizações

// RENTABILIDADE BRUTA
// RB = (Renda mensal × 12) / Valor imóvel × 100

// RENTABILIDADE LÍQUIDA
// Despesas anuais = IMI + Condomínio×12 + Manutenção + Seguro + IRS predial
// IRS predial = Renda anual × 28% (ou englobamento — calcular ambos)
// RL = (Renda anual - Despesas anuais) / Valor imóvel × 100
// Output: RL bruta, RL líquida (taxa autónoma), RL líquida (englobamento), recomendação

// YIELD ON COST
// YoC = Renda anual / Preço de compra original × 100
// Diferente da rentabilidade atual — retorno sobre o investimento original

// CAP RATE
// NOI = Rendimento bruto - Despesas operacionais (exceto financiamento)
// Cap Rate = NOI / Valor de mercado atual × 100

// CASH-ON-CASH RETURN
// Capital próprio = Entrada + IMT + IS + Custos notariais
// Fluxo líquido = Rendas - Prestação crédito - Despesas operacionais
// CoC = Fluxo líquido anual / Capital próprio × 100

// IMT — Imposto Municipal sobre Transmissões 2025
// Habitação própria permanente:
//   Até €97.064:           0%
//   €97.064 - €132.774:   2%
//   €132.774 - €181.034:  5%
//   €181.034 - €301.688:  7%
//   €301.688 - €603.289:  8%
//   > €1.102.920:          7.5% (taxa única)
// Habitação secundária/arrendamento: 1% adicional em cada escalão
// IS (Imposto de Selo): 0.8% do valor de compra
// Custos notariais estimados: ~€800-1200
// Output: IMT, IS, total custos aquisição

// SIMULADOR DE VACÂNCIA
// Inputs: renda mensal, meses vazios por ano (slider 0-12)
// Output: rendimento real anual, impacto na rentabilidade, break-even de vacância

// RENDA MÍNIMA PARA BREAK-EVEN
// "Qual a renda que torna o imóvel auto-sustentável?"
// Renda mínima = Prestação crédito + IMI/12 + Condomínio + Seguro/12
// Output: renda mínima, yield mínima necessária

// COMPARATIVO MULTI-IMÓVEL
// Comparar até 3 imóveis com todas as métricas lado a lado
// Output: tabela comparativa (RB, RL, YoC, Cap Rate, CoC)

// RENDA VITALÍCIA / RENDIMENTO PASSIVO
// Inputs: capital disponível, taxa de retorno, período (anos)
// Renda mensal = C × i_m / [1 - (1+i_m)^(-n)]
// Output: renda mensal sustentável, total recebido, gráfico de depleção do capital
```

---

### TAB 5 — TIR / VAL / Análise de Projetos

```typescript
// VAL — Valor Atual Líquido
// VAL = Σ [FC_t / (1+i)^t] - I_0
// Inputs: investimento inicial (I_0), taxa de desconto (i),
//         fluxos de caixa anuais (tabela editável, até 20 anos)
// Output: VAL (>0 = viável), gráfico de fluxos acumulados

// TIR — Taxa Interna de Retorno
// Taxa i que torna VAL = 0
// Calcular por método de Newton-Raphson ou bisseção (iterativo)
// Output: TIR%, comparação com taxa de desconto ("vale a pena se TIR > custo capital")

// PAYBACK PERIOD
// Simples: ano em que Σ FC = I_0
// Descontado: considera valor temporal do dinheiro
// Output: anos até recuperar, gráfico de payback acumulado

// ÍNDICE DE RENDIBILIDADE
// IR = (VAL + I_0) / I_0  ou  IR = VAL/I_0 + 1
// IR > 1 → projeto viável
// Output: IR, interpretação ("por cada €1 investido, ganhas €X")
```

---

### TAB 6 — Fiscal Portugal

```typescript
// IRS SOBRE MAIS-VALIAS (Ações/ETFs)
// Taxa autónoma: 28%
// Isenção 50%: ativos detidos > 2 anos (OE 2023)
// Mais-valia = (P_venda - P_compra) × quantidade
// IRS_autonomo = mais_valia × 28%
// IRS_isenção  = mais_valia × 50% × 28%  (se > 2 anos)
// Englobamento: depende do escalão de IRS do user
// Inputs: preço compra, preço venda, quantidade, data compra, rendimento anual (para englobamento)
// Output: mais-valia bruta, IRS autónoma, IRS com isenção 50%, IRS englobamento, recomendação

// IRS SOBRE DIVIDENDOS
// Retenção na fonte: 28% (Portugal) ou taxa do país de origem
// Crédito de imposto por dupla tributação económica disponível
// Inputs: dividendo bruto, país de origem, taxa retida na fonte
// Output: dividendo líquido, IRS adicional (se aplicável)

// IRS PREDIAL — ARRENDAMENTO
// Autónoma: 28% sobre rendimento predial
// Englobamento: taxas progressivas 14.5% a 48%
// Deduções: 35% das despesas documentadas (reparações, IMI, condomínio)
// Output: IRS autónoma vs englobamento, recomendação, deduções possíveis

// PPR vs ETF (15-30 anos)
// PPR: dedução 20% até €400/ano (escalão 1) na entrega IRS
//      penalização de 10% se resgatar antes dos requisitos
//      taxa final: 8% se resgatar na reforma
// ETF: sem benefício fiscal na entrada
//      28% na saída (50% isento se > 2 anos)
// Inputs: capital mensal, prazo, taxa de retorno estimada, escalão IRS
// Output: valor final líquido de cada opção, gráfico comparativo, recomendação

// IMI — Imposto Municipal sobre Imóveis
// Taxa: 0.3% a 0.45% do VPT (definida pelo município)
// Isenção: 3 anos hab. própria permanente (pedir ao município)
// Inputs: VPT, município (dropdown com taxas de cada município PT)
// Output: IMI anual, mensal, impacto na rentabilidade
```

---

### TAB 7 — CS2 & Steam

```typescript
// ROI DE SKIN
// Comissão Steam: 15% (13% Steam + 2% desenvolvedor)
// Valor líquido venda = preço_mercado × 0.85
// ROI = (valor_liquido - preço_compra) / preço_compra × 100
// ROI anualizado = ((1 + ROI/100)^(1/anos_detidos) - 1) × 100
// Inputs: preço de compra, preço atual (da Steam API se conectado), data compra
// Output: lucro/prejuízo em €, ROI total, ROI anualizado,
//         comparação com S&P500 / VWCE / Bitcoin no mesmo período

// SIMULADOR DE ABERTURA DE CAIXAS
// Probabilidades oficiais CS2:
//   Mil-Spec (azul):         79.92%
//   Restricted (roxo):       15.98%
//   Classified (rosa):        3.20%
//   Covert (vermelho):        0.64%
//   ★ Rare Special (dourado): 0.26%
// Custo por abertura = preço_caixa + €2.19 (chave)
// EV = Σ(probabilidade × preço_médio_item_nessa_raridade × 0.85)
// Inputs: caixa selecionada (lista das principais), preços dos itens por raridade
// Output: EV por abertura, break-even (nº aberturas para recuperar),
//         "vender caixa compensa mais" se EV < preço_caixa

// IMPACTO DO FLOAT NO PREÇO
// Wear tiers: FN(0.00-0.07) | MW(0.07-0.15) | FT(0.15-0.38) | WW(0.38-0.45) | BS(0.45-1.00)
// Inputs: skin, float value (slider 0.00-1.00)
// Output: wear tier, multiplicador de preço estimado vs float médio do mercado

// COMPARATIVO SKIN vs ATIVOS TRADICIONAIS
// Inputs: capital, data de início, skin escolhida
// Buscar preço histórico na Steam API (ou dados simulados)
// Comparar com: Bitcoin, VWCE, S&P500, Depósito a Prazo
// Output: gráfico comparativo, tabela de retornos, "o melhor investimento foi..."
```

---

## 🌐 BACKEND — ROTAS API COMPLETAS

```
AUTH
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me
GET    /api/auth/steam
GET    /api/auth/steam/callback

USER
GET    /api/users/:id
PUT    /api/users/me
PUT    /api/users/me/password
PUT    /api/users/me/preferences
PUT    /api/users/me/notifications
PUT    /api/users/me/privacy
DELETE /api/users/me
GET    /api/users/me/export

INCOME & EXPENSES
GET    /api/income?month=&year=
POST   /api/income
PUT    /api/income/:id
DELETE /api/income/:id
GET    /api/income/stats?year=
GET    /api/expenses?month=&year=
POST   /api/expenses
PUT    /api/expenses/:id
DELETE /api/expenses/:id
GET/PUT /api/budget?month=&year=

PROPERTIES & RENTS
GET    /api/properties
POST   /api/properties
PUT    /api/properties/:id
DELETE /api/properties/:id
GET    /api/properties/:id/analytics
GET    /api/rents?propertyId=
POST   /api/rents
PUT    /api/rents/:id
DELETE /api/rents/:id
GET    /api/rents/stats
GET    /api/rents/ine-coefficients      → coeficientes históricos INE

PORTFOLIO
GET    /api/portfolio
POST   /api/portfolio
PUT    /api/portfolio/:id
DELETE /api/portfolio/:id
GET    /api/portfolio/performance

STEAM
GET    /api/steam/inventory
GET    /api/steam/item?name=&appId=     → preço + histórico
GET    /api/steam/portfolio             → valor total
POST   /api/steam/watchlist
DELETE /api/steam/watchlist/:id

INTEGRATIONS
POST   /api/integrations/trading212/key
GET    /api/integrations/trading212/sync
POST   /api/integrations/traderepublic/import

MARKETS (cache Redis 5min)
GET    /api/markets/euribor             → 3M/6M/12M + histórico
GET    /api/markets/rates               → TEAG, BCE, bancos PT
GET    /api/markets/indices             → PSI20, S&P500, NASDAQ, DAX
GET    /api/markets/crypto              → top 10 (CoinGecko)
GET    /api/markets/forex               → EUR/USD/GBP/CHF
GET    /api/markets/stock?ticker=       → Alpha Vantage
GET    /api/markets/etf?ticker=

ALERTS
GET    /api/alerts
POST   /api/alerts
PUT    /api/alerts/:id
DELETE /api/alerts/:id

GOALS
GET    /api/goals
POST   /api/goals
PUT    /api/goals/:id
DELETE /api/goals/:id

SIMULATIONS
GET    /api/simulations
POST   /api/simulations
DELETE /api/simulations/:id

FORUM
GET    /api/posts?tag=&page=&sort=      → sort: recent|trending|top
POST   /api/posts
GET    /api/posts/:id
PUT    /api/posts/:id
DELETE /api/posts/:id
POST   /api/posts/:id/vote              → { direction: 'up'|'down' }
GET    /api/posts/:id/comments
POST   /api/posts/:id/comments
PUT    /api/comments/:id
DELETE /api/comments/:id
GET    /api/posts/trending

SOCKET.IO EVENTS
'alert:triggered'  → { type, message, data }
'market:update'    → { euribor, indices }
'forum:reply'      → { postId, comment }
'forum:mention'    → { postId, user }
```

---

## 🎨 IDENTIDADE VISUAL

```scss
// styles/_variables.scss
:root {
  // Paleta (inspiração Anthropic)
  --sand:       #f0ebe0;   // background principal
  --sand2:      #e6dfd1;   // hover, inputs
  --sand3:      #d4cab8;   // borders
  --terra:      #c96a45;   // primária, CTAs, active
  --terra2:     #b85c38;   // hover
  --terra-l:    #e07a52;   // variante clara
  --terra-dim:  rgba(201,106,69,0.10);
  --sage:       #5f7e5f;   // sucesso, positivo
  --sage-l:     #7a9e7a;
  --sage-dim:   rgba(95,126,95,0.10);
  --lilac:      #8b80c8;   // informação
  --lilac-dim:  rgba(139,128,200,0.12);
  --gold:       #c9a84c;   // alertas, rare items
  --gold-dim:   rgba(201,168,76,0.12);
  --ink:        #1e1812;   // texto principal
  --ink2:       #2e2418;   // sidebar, footer
  --brown:      #5a4a3a;   // texto secundário
  --muted:      #8a7a6a;   // labels, placeholders
  --white:      #faf9f6;   // cards, sidebar bg
  --border:     rgba(90,74,58,0.12);
  --shadow:     0 2px 12px rgba(42,32,24,0.07);
  --shadow-lg:  0 8px 32px rgba(42,32,24,0.10);

  // Tipografia
  // Títulos:  Lora (serif, editorial) — Google Fonts
  // UI/Corpo: DM Sans (sans-serif, limpo) — Google Fonts
  // Números:  DM Mono (monospace, dados financeiros) — Google Fonts

  // Layout
  --sidebar-width: 240px;
  --topbar-height: 56px;
  --radius-sm:     8px;
  --radius:        12px;
  --radius-lg:     16px;
  --radius-full:   100px;
}
```

---

## 🚀 ORDEM DE DESENVOLVIMENTO

### Fase 1 — Foundation (semana 1-2)
1. Setup Angular 17 routing + lazy loading
2. Auth completo (register/login/JWT/refresh)
3. Sidebar + Topbar como componentes standalone reutilizáveis
4. Dashboard com dados reais do user (stat cards, gráfico patrimônio)
5. Deploy inicial Vercel + Render

### Fase 2 — Core Features (semana 2-4)
6. Income Tracker (CRUD + gráficos + orçamento por categoria)
7. Taxas & Mercados (Euribor + índices + cache Redis)
8. Settings page completa (perfil, notificações, preferências, privacidade)
9. Sistema de alertas (cron job backend + Socket.io)

### Fase 3 — Simulador Completo (semana 4-6)
10. financial.utils.ts com todas as fórmulas
11. Tab 1: Juros (simples, composto, contínuo, conversão de taxas, desconto)
12. Tab 2: Investimento (DCA, FIRE, dividendos, inflação, TER, retorno histórico)
13. Tab 3: Crédito Habitação (prestação, comparador bancos, stress test, amortização, LTV, rácio esforço, buy vs rent, refinanciamento)
14. Tab 4: Rendas & Imóveis (atualização INE simples/composta, rentabilidade bruta/líquida, YoC, Cap Rate, CoC, IMT, vacância, renda mínima, multi-imóvel, renda vitalícia)
15. Tab 5: TIR/VAL/Payback/IR
16. Tab 6: Fiscal PT (mais-valias, dividendos, predial, PPR vs ETF, IMI)
17. Tab 7: CS2 (ROI, simulador caixas, float, comparativo)

### Fase 4 — Imóveis & Steam (semana 6-7)
18. Gestão de imóveis + rendas CRUD
19. Steam OpenID + sincronização de inventário
20. Portfólio ETF/ações CRUD + performance
21. Watchlists + alertas de preço

### Fase 5 — Comunidade (semana 7-8)
22. Fórum (posts, comentários, votação, tags, trending)
23. Perfis públicos com portfólio partilhado
24. Sistema de reputação + flairs
25. Notificações em tempo real Socket.io

### Fase 6 — Integrações & Polish (semana 8-9)
26. Trading 212 API key + sync
27. Trade Republic CSV/PDF import + parser
28. Export de dados (CSV/PDF — RGPD)
29. Performance (OnPush, trackBy, virtual scroll)
30. PWA (service worker, offline básico)

---

## 🔒 SEGURANÇA

```
- helmet.js em todas as rotas Express
- Rate limiting: 100 req/15min por IP (express-rate-limit)
- CORS: apenas domínios permitidos (Vercel + localhost:4200)
- API keys de terceiros: encriptadas AES-256 antes de guardar na DB
- Sanitização: DOMPurify no frontend, Joi no backend
- JWT secret: rotação recomendada a cada 30 dias
- Logs: Winston sem PII
- Variáveis sensíveis: sempre em .env, nunca no código
```

---

## 📦 PACKAGES ESSENCIAIS

### Backend
```json
{
  "express": "^4.19",
  "mongoose": "^8.3",
  "jsonwebtoken": "^9.0",
  "bcrypt": "^5.1",
  "cors": "^2.8",
  "helmet": "^7.1",
  "express-rate-limit": "^7.2",
  "dotenv": "^16.4",
  "socket.io": "^4.7",
  "redis": "^4.6",
  "passport": "^0.7",
  "passport-steam": "^1.0",
  "multer": "^1.4",
  "nodemailer": "^6.9",
  "joi": "^17.13",
  "winston": "^3.13",
  "axios": "^1.7",
  "node-cron": "^3.0",
  "pdf-parse": "^1.1",
  "csv-parser": "^3.0"
}
```

### Frontend
```json
{
  "chart.js": "^4.4",
  "ng2-charts": "^6.0",
  "socket.io-client": "^4.7"
}
```

---

## 💡 NOTAS PARA O AI NO VS CODE

1. **Consulta os ficheiros existentes** antes de criar novos — o projeto já tem estrutura base Angular + Express
2. **Standalone components** — sem NgModules, usar `imports: []` em cada componente
3. **Reactive Forms** em todos os formulários do simulador
4. **Chart.js via ng2-charts** para todos os gráficos
5. **Signals** para estado local, **RxJS** para streams HTTP e Socket.io
6. **Interceptor auth** — adicionar `Authorization: Bearer {token}` a todos os pedidos HTTP
7. **Interceptor error** — tratar 401 (fazer refresh automático), 403, 500 globalmente
8. **OnPush** em componentes que não dependem de estado mutável
9. **TrackBy** em todos os `*ngFor` com listas
10. **Fórmulas financeiras** — implementar como pure functions exportadas de `financial.utils.ts`, nunca inline nos componentes
11. **Cache frontend** — usar `shareReplay(1)` em pedidos que não mudam frequentemente
12. **Environments** — nunca hardcode URLs, sempre `environment.apiUrl`
13. **SCSS** — usar as variáveis CSS definidas em `_variables.scss`, nunca cores hardcoded nos componentes
14. **Lazy loading** — cada feature é um módulo carregado sob demanda em `app.routes.ts`
15. **Fórmulas do simulador** — sempre recalcular em tempo real no `onChange` dos inputs, nunca só no submit

---

*Projeto: WealthSphere · Repositório: diogoduarte2000/WealthSphere*
*Prompt gerado: Maio 2025 · Versão definitiva com simulador completo*