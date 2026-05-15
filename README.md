# WealthSphere

Plataforma financeira completa para gestão pessoal, investimentos e mercados alternativos.

## 🚀 Visão Geral

WealthSphere é uma aplicação web moderna que permite:
- Dashboard pessoal com património e investimentos
- Acompanhamento de rendimentos e despesas
- Simulador de cenários de investimento e FIRE
- Taxas de juro em tempo real (Euribor, TEAG, BCE)
- Integração com Steam para inventário de CS2
- Comunidade de investidores

## 🛠️ Tecnologias

### Frontend
- **Framework**: Angular 17
- **Linguagem**: TypeScript
- **Estilos**: CSS com variáveis customizadas
- **Animações**: Angular Animations
- **Lazy Loading**: Componentes carregados sob demanda
- **Preloading**: Estratégia PreloadAllModules para performance

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Autenticação**: Passport.js com Steam OpenID
- **Base de Dados**: MongoDB
- **API REST**: Endpoints para dados financeiros

## 📦 Instalação

### Pré-requisitos
- Node.js 18+
- npm ou yarn
- MongoDB (local ou cloud)

### Frontend
```bash
cd frontend
npm install
npm run build
npm start
```

### Backend
```bash
cd backend
npm install
npm start
```

## 🔧 Configuração

### Variáveis de Ambiente
Crie um ficheiro `.env` no backend:
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/wealthsphere
STEAM_API_KEY=your_steam_api_key
SESSION_SECRET=your_session_secret
```

### Frontend Environment
Configure em `frontend/src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  apiUrl: 'https://wealthsphere-backend.onrender.com/api'
};
```

## 🌐 Deploy

### Frontend (Vercel)
1. Conectar repositório GitHub ao Vercel
2. Configurar:
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist/frontend`

### Backend (Render)
1. Conectar repositório GitHub ao Render
2. Configurar Web Service
3. Adicionar variáveis de ambiente

## 📊 Funcionalidades

### Dashboard
- Visão geral do património
- Gráficos de evolução
- Alertas de taxas
- Acesso rápido a todas as secções

### Income Tracker
- Registo de receitas
- Registo de despesas
- Categorização automática
- Relatórios mensais

### Simulador
- Cenários de investimento
- Projeções FIRE
- Comparação de estratégias
- Exportação de resultados

### Taxas & Mercados
- Euribor 3M/6M/12M em tempo real
- TEAG dos bancos
- Taxa de depósito BCE
- Índices bolsistas
- Atualização automática (cada hora)

### CS2 & Steam
- Inventário sincronizado
- Valores de mercado
- Histórico de transações
- Alertas de valorização

## 🔐 Autenticação

### Steam Login
- OpenID Connect
- Sessões seguras
- Sync automático do inventário

## 📈 API

### Endpoints Principais
- `GET /api/auth/steam` - Login Steam
- `GET /api/rates` - Taxas em tempo real
- `GET /api/user/:id` - Dados do utilizador
- `GET /api/inventory/:steamId` - Inventário Steam

## 🤝 Contribuição

1. Fork o repositório
2. Crie branch para feature (`git checkout -b feature/nova-feature`)
3. Commit mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para branch (`git push origin feature/nova-feature`)
5. Abra Pull Request

## 📝 Licença

Este projeto está em desenvolvimento.

## 👥 Equipa

- Diogo Duarte - Desenvolvimento

## 📞 Contacto

- GitHub: [@diogoduarte2000](https://github.com/diogoduarte2000)
- Email: [contacto@wealthsphere.pt](mailto:contacto@wealthsphere.pt)

## 🔗 Links

- [Frontend Vercel](https://wealth-sphere-eblw8c1kq-diogosilvanoduarte-3890s-projects.vercel.app/)
- [Backend Render](https://wealthsphere-backend.onrender.com)
- [Repositório GitHub](https://github.com/diogoduarte2000/WealthSphere)

---

Feito em Portugal 🇵🇹
