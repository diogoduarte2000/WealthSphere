# Deploy no Vercel

## Configuração Atual
- **Backend**: https://wealthsphere-backend.onrender.com
- **Frontend**: Angular app configurado para conectar ao backend

## Passos para Deploy no Vercel

### 1. Criar conta no Vercel
- Aceder a https://vercel.com
- Criar conta usando GitHub

### 2. Importar projeto no Vercel
1. No dashboard do Vercel, clicar em "Add New Project"
2. Selecionar o repositório `diogoduarte2000/WealthSphere`
3. Configurar as seguintes opções:

**Framework Preset**: Angular
**Root Directory**: `frontend`
**Build Command**: `npm run build`
**Output Directory**: `dist/frontend`

### 3. Variáveis de Ambiente
Não são necessárias variáveis de ambiente adicionais, pois a URL do backend já está configurada em:
- `src/environments/environment.ts` (desenvolvimento)
- `src/environments/environment.prod.ts` (produção)

Ambos apontam para: `https://wealthsphere-backend.onrender.com/api`

### 4. Deploy
1. Clicar em "Deploy"
2. O Vercel irá construir e fazer o deploy automaticamente
3. Após o deploy, o site estará disponível em um URL do Vercel

### 5. Configurar Domínio Personalizado (Opcional)
1. Nas configurações do projeto no Vercel
2. Aceder a "Domains"
3. Adicionar o domínio personalizado
4. Configurar os DNS conforme instruções do Vercel

## Comandos Úteis

### Build local para teste
```bash
cd frontend
npm install
npm run build
```

### Testar localmente após build
```bash
cd frontend
npm install -g http-server
http-server dist/frontend
```

## Notas Importantes
- O Vercel fará deploy automático sempre que houver push no branch principal
- Para branches diferentes, o Vercel criará URLs de preview
- Certifique-se de que o branch principal está atualizado antes do deploy de produção
