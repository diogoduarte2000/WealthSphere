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

## 📦 Instalação

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Frontend
```bash
cd frontend
npm install
npm run build
npm start
```

## 🔧 Configuração

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

## 🤝 Contribuição

1. Fork o repositório
2. Crie branch para feature (`git checkout -b feature/nova-feature`)
3. Commit mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para branch (`git push origin feature/nova-feature`)
5. Abra Pull Request

## 📝 Licença

Este projeto está em desenvolvimento.

## � Links

- [WealthSphere](https://wealth-sphere-eblw8c1kq-diogosilvanoduarte-3890s-projects.vercel.app/)
- [Repositório GitHub](https://github.com/diogoduarte2000/WealthSphere)

---

Feito em Portugal 🇵🇹
