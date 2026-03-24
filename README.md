# MedDoc — Repositório de Prontuários

Sistema web completo para indexação, upload, revisão e auditoria de prontuários médicos.
**Stack 100% gratuita:** Supabase + Render + UptimeRobot + GitHub Actions.

---

## Arquitetura

```
GitHub (código-fonte)
   │
   ├─▶ GitHub Actions (CI — build + lint em todo PR)
   │
   ├─▶ Render Web Service Free (Node.js + Express)
   │      ├─ Serve o build Vite (React SPA)
   │      └─ /health → UptimeRobot bate aqui a cada 5 min
   │                   (evita que o serviço durma no plano Free)
   │
   ├─▶ Supabase (plano Free)
   │      ├─ Auth    : login e-mail/senha + roles (admin/revisor/operador)
   │      ├─ DB      : PostgreSQL — prontuarios, profiles, audit_logs
   │      ├─ Storage : bucket privado "prontuarios" (PDF, JPG, PNG)
   │      └─ RLS     : Row Level Security por role
   │
   └─▶ UptimeRobot (ping a cada 5 min → Render Free nunca dorme)
```

### Limites gratuitos

| Serviço     | Limite Free                              |
|-------------|------------------------------------------|
| Supabase    | 500 MB banco · 1 GB Storage · 50k MAU    |
| Render      | 750 h/mês Web Service (= 24/7 contínuo)  |
| UptimeRobot | 50 monitores · intervalo 5 min           |
| GitHub      | Actions: 2.000 min/mês                   |

### Ampliar storage sem custo

Se o 1 GB do Supabase não for suficiente, migre apenas o storage para
**Cloudflare R2** (10 GB/mês grátis). Veja `supabase/migrations/003_cloudflare_r2_notes.sql`.

---

## Pré-requisitos

- Node.js 18+
- Conta GitHub
- Conta Supabase (gratuita)
- Conta Render (gratuita)
- Conta UptimeRobot (gratuita)

---

## Implantação passo a passo

### 1. Clonar e configurar localmente

```bash
git clone https://github.com/SEU_USUARIO/meddoc.git
cd meddoc
npm install
cp .env.example .env
# Edite .env com suas credenciais do Supabase
npm run dev
```

---

### 2. Supabase

1. Acesse [supabase.com](https://supabase.com) → **New project**
2. Aguarde o provisionamento (~2 min)
3. Vá em **Settings → API** e copie:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`
4. Vá em **SQL Editor** e execute **cada arquivo em ordem**:
   - `supabase/migrations/001_initial_schema.sql` ← obrigatório
   - `supabase/migrations/002_seed_demo.sql` ← opcional (dados demo)
5. Crie o **primeiro usuário admin**:
   - Auth → Users → **Add user** (email + senha)
   - Copie o UUID gerado
   - No SQL Editor execute:
     ```sql
     UPDATE profiles SET role = 'admin', name = 'Seu Nome'
     WHERE id = 'cole-o-uuid-aqui';
     ```
6. Para criar usuários adicionais use a Edge Function ou o painel:
   - Auth → Users → **Invite user** → depois ajuste o role via SQL

---

### 3. GitHub

1. Crie um repositório no GitHub e faça push do código:
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/meddoc.git
   git push -u origin main
   ```
2. Vá em **Settings → Secrets and variables → Actions** e adicione:
   - `VITE_SUPABASE_URL` — URL do seu projeto Supabase
   - `VITE_SUPABASE_ANON_KEY` — chave anon do Supabase

O workflow `.github/workflows/deploy.yml` roda build em todo PR e push no main.

---

### 4. Render

1. Acesse [render.com](https://render.com) → **New → Web Service**
2. Conecte sua conta GitHub e selecione o repositório `meddoc`
3. Configure:
   - **Environment:** Node
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `node server.cjs`
   - **Plan:** Free
4. Em **Environment Variables** adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `NODE_ENV` = `production`
5. Clique **Create Web Service**
6. Aguarde o primeiro deploy (~3 min)
7. Anote a URL gerada, ex: `https://meddoc.onrender.com`

O Render faz **re-deploy automático** a cada push na branch `main`.

---

### 5. UptimeRobot

1. Acesse [uptimerobot.com](https://uptimerobot.com) → **Add New Monitor**
2. Configure:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** MedDoc
   - **URL:** `https://meddoc.onrender.com/health`
   - **Monitoring Interval:** 5 minutes
3. Em **Alert Contacts**, adicione seu e-mail
4. Clique **Create Monitor**

> O endpoint `/health` responde JSON com status, uptime e configuração.
> O Render Free dorme após 15 min sem requisição — o UptimeRobot evita isso.

---

### 6. Edge Function (opcional — para convite de usuários)

Se quiser convidar usuários pelo painel do sistema (sem acessar o Supabase):

```bash
# Instale o CLI do Supabase
npm install -g supabase

# Login e link ao projeto
supabase login
supabase link --project-ref SEU_PROJECT_REF

# Deploy da função
supabase functions deploy invite-user
```

---

## Roles e permissões

| Ação                        | Admin | Revisor | Operador |
|-----------------------------|:-----:|:-------:|:--------:|
| Buscar prontuários          | ✅    | ✅      | ✅       |
| Fazer upload                | ✅    | ❌      | ✅       |
| Revisar (aprovar/reprovar)  | ✅    | ✅      | ❌       |
| Ver logs de auditoria       | ✅    | ✅      | ❌       |
| Gerenciar lixeira           | ✅    | ❌      | ❌       |
| Painel admin / usuários     | ✅    | ❌      | ❌       |

---

## Estrutura do projeto

```
meddoc/
├── .github/workflows/
│   └── deploy.yml              ← CI/CD GitHub Actions
├── supabase/
│   ├── functions/
│   │   └── invite-user/        ← Edge Function para convites
│   └── migrations/
│       ├── 001_initial_schema.sql   ← Schema + RLS + Storage
│       ├── 002_seed_demo.sql        ← Dados demo (opcional)
│       └── 003_cloudflare_r2_notes.sql ← Guia migração R2
├── src/
│   ├── lib/
│   │   └── storage.js          ← Abstração do provider (fácil trocar)
│   ├── hooks/
│   │   ├── useAuth.jsx         ← Context de autenticação
│   │   └── useAuditLog.js      ← Hook de auditoria
│   ├── components/
│   │   ├── Layout.jsx          ← Nav + Sidebar responsiva
│   │   └── UI.jsx              ← Botões, badges, modais, tabela
│   ├── pages/
│   │   ├── LoginPage.jsx       ← Login com pills de demo
│   │   ├── BuscaPage.jsx       ← Busca + paginação + modal detalhe
│   │   ├── UploadPage.jsx      ← Dropzone + formulário + lock
│   │   ├── RevisaoPage.jsx     ← Fila + viewer + decisão
│   │   ├── LogsPage.jsx        ← Auditoria filtrada
│   │   ├── LixeiraPage.jsx     ← Restaurar / excluir permanente
│   │   └── AdminPage.jsx       ← Stats + gestão de usuários
│   ├── styles/global.css
│   ├── App.jsx                 ← Roteamento + guard por role
│   └── main.jsx
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── render.yaml
├── server.cjs                  ← Express: serve dist/ + /health
└── vite.config.js
```

---

## Trocar de provider (Storage / Banco)

O arquivo `src/lib/storage.js` é a **única camada de integração**.
Para migrar para Firebase, Appwrite, PocketBase ou qualquer outro:

1. Reimplemente as funções exportadas em `storage.js`
2. Atualize as env vars no `.env` e no Render
3. O restante do app (páginas, componentes, hooks) **não muda**

---

## Licença

MIT — use, modifique e distribua livremente.
