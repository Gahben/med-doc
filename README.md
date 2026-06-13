# MedDoc — Sistema de Gestão de Prontuários Médicos

O **MedDoc** é uma aplicação web para hospitais e clínicas que precisam **receber solicitações de pacientes**, **digitalizar prontuários**, **controlar um fluxo de produção interno** e **auditar documentos** antes da entrega — tudo com rastreabilidade (logs, notificações e papéis de acesso distintos).

Este repositório contém a **versão principal em produção**: uma **SPA React** (Vite) servida por **Node.js/Express** no **Render**, com backend em **Supabase** (PostgreSQL, Auth, Storage e Edge Functions).

> **Nota:** existe uma pasta `meddoc/` com um protótipo antigo em **Next.js**. A aplicação ativa é a da **raiz do repositório** (`src/`, `vite.config.js`, `server.cjs`).

---

## Índice

1. [O que o sistema faz](#o-que-o-sistema-faz)
2. [Para quem é](#para-quem-é)
3. [Arquitetura](#arquitetura)
4. [Stack tecnológica](#stack-tecnológica)
5. [Fluxo de trabalho unificado](#fluxo-de-trabalho-unificado)
6. [Perfis de usuário e permissões](#perfis-de-usuário-e-permissões)
7. [Rotas da aplicação](#rotas-da-aplicação)
8. [Modelo de dados](#modelo-de-dados)
9. [Estrutura do projeto](#estrutura-do-projeto)
10. [Como rodar localmente](#como-rodar-localmente)
11. [Configurar o Supabase](#configurar-o-supabase)
12. [Deploy em produção](#deploy-em-produção)
13. [Edge Functions](#edge-functions)
14. [Guia para desenvolver e estender](#guia-para-desenvolver-e-estender)
15. [Estilização (CSS Modules + Tailwind)](#estilização-css-modules--tailwind)
16. [Solução de problemas](#solução-de-problemas)
17. [Licença](#licença)

---

## O que o sistema faz

O MedDoc cobre **dois mundos** que conversam entre si:

| Mundo | Quem usa | O que acontece |
|-------|----------|----------------|
| **Portal do paciente** | Público (sem login) | Solicita cópia de prontuário, baixa PDF para assinar, envia documento assinado e acompanha status pelo token |
| **Painel interno** | Equipe do hospital | Revisa solicitações, produz/digitaliza prontuários, audita qualidade e registra entrega |

Funcionalidades principais:

- **Solicitação online** (`/solicitacao`) com geração de token e PDF (jsPDF)
- **Acompanhamento público** (`/acompanhamento`) pelo token
- **Painel do revisor** — aprova, recusa ou encaminha para produção (com link WhatsApp)
- **Upload** vinculado à solicitação, com número de prontuário automático (`AAAAMMDD-XXXX`)
- **Produção** — operador move o fluxo (auditoria, não localizado, correções)
- **Auditoria** — auditor aprova para entrega ou solicita correção
- **Busca** com filtros, visualização de PDF, vínculo com solicitação
- **Logs de auditoria** exportáveis (CSV)
- **Lixeira** com restauração
- **Admin** — estatísticas, usuários, convites
- **Notificações** in-app por mudança de status
- **Versionamento** de arquivos (histórico de uploads e correções)
- **Detecção de duplicatas** por hash SHA-256

---

## Para quem é

| Perfil | Responsabilidade no processo |
|--------|---------------------------|
| **Paciente / familiar** | Preenche formulário, assina PDF, acompanha andamento |
| **Revisor** | Confere dados e documento assinado; aprova ou recusa; contato via WhatsApp se houver divergência |
| **Operador** | Digitaliza/envia prontuário, vincula à solicitação, conduz produção e entrega |
| **Auditor** | Revisa qualidade do documento digitalizado |
| **Admin** | Usuários, estatísticas, configurações |

---

## Arquitetura

Visão de alto nível — tudo que acontece quando alguém usa o sistema:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NAVEGADOR (usuário)                              │
│  React 18 SPA  ·  React Router  ·  CSS Modules + Tailwind (rotas públicas)│
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Render — Web Service (Node.js)                        │
│  server.cjs                                                              │
│    ├── GET /health, /ping     → monitoramento (UptimeRobot)             │
│    ├── express.static(dist/)  → arquivos do build Vite                  │
│    └── fallback → index.html  → roteamento client-side (SPA)            │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Supabase (BaaS)                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │ Auth        │  │ PostgreSQL   │  │ Storage     │  │ Edge Funcs   │ │
│  │ e-mail/senha│  │ + RLS        │  │ bucket      │  │ invite-user  │ │
│  │ Google OAuth│  │ profiles,    │  │ prontuarios │  │ workflow-    │ │
│  │             │  │ prontuarios, │  │ patient_req │  │ webhook, etc │ │
│  │             │  │ patient_req… │  │             │  │              │ │
│  └─────────────┘  └──────────────┘  └─────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                ▲
                                │ CI (opcional)
┌───────────────────────────────┴─────────────────────────────────────────┐
│  GitHub Actions — build em PR/push  ·  Render redeploy automático no main│
└─────────────────────────────────────────────────────────────────────────┘
```

### Por que essa arquitetura?

- **Frontend estático (Vite)** — build rápido, deploy simples, sem servidor SSR.
- **Supabase** — banco, autenticação, storage e políticas de segurança (RLS) sem manter backend próprio.
- **Express mínimo** — só serve arquivos e expõe `/health` (plano Free do Render “dorme” sem tráfego).
- **`storage.js`** — camada única de integração; trocar Supabase por outro provedor exige mudar basicamente esse arquivo.

### Limites do tier gratuito (referência)

| Serviço | Plano Free (aprox.) |
|---------|---------------------|
| Supabase | ~500 MB banco · ~1 GB Storage · 50k MAU |
| Render | 750 h/mês Web Service |
| UptimeRobot | 50 monitores · ping a cada 5 min |
| GitHub Actions | 2.000 min/mês |

Para ampliar storage sem custo imediato, veja `supabase/migrations/003_cloudflare_r2_notes.sql` (Cloudflare R2).

---

## Stack tecnológica

### Frontend (raiz do projeto)

| Tecnologia | Uso |
|------------|-----|
| **React 18** | Interface e componentes |
| **Vite 6** | Bundler e dev server |
| **React Router 7** | Rotas públicas e autenticadas |
| **CSS Modules** | Estilo das páginas internas (painel) |
| **Tailwind CSS 3** | Rotas públicas (`/solicitacao`, `/acompanhamento`) |
| **react-hot-toast** | Feedback visual |
| **react-dropzone** | Upload por arrastar e soltar |
| **date-fns** | Datas em português |
| **jspdf** | Geração do PDF de solicitação |
| **lucide-react** | Ícones (onde usado) |
| **xlsx** | Exportação de planilhas nos logs |

### Backend / infra

| Tecnologia | Uso |
|------------|-----|
| **Supabase** | PostgreSQL, Auth, Storage, RLS, RPC, Edge Functions |
| **@supabase/supabase-js** | Cliente JavaScript no browser |
| **Express 5** | Servidor de produção (`server.cjs`) |
| **Node.js 18+** | Runtime |

### Ferramentas de desenvolvimento

| Ferramenta | Uso |
|------------|-----|
| **PostCSS + Autoprefixer** | Pipeline do Tailwind |
| **GitHub Actions** | CI — `npm ci` + `npm run build` |
| **Supabase CLI** | Deploy de Edge Functions |
| **UptimeRobot** | Keep-alive do Render Free |

---

## Fluxo de trabalho unificado

O coração do negócio está em **`workflow_status`**, sincronizado entre **`patient_requests`** (solicitação do paciente) e **`prontuarios`** (documento digitalizado), quando vinculados.

### Diagrama do fluxo

```
                    ┌──────────────┐
                    │   RECEBIDA   │  ← paciente envia formulário + PDF assinado
                    └──────┬───────┘
                           │ Revisor analisa (WhatsApp se necessário)
              ┌────────────┴────────────┐
              ▼                         ▼
    ┌─────────────────┐       ┌─────────────────┐
    │ SOLICITAÇÃO     │       │ SOLICITAÇÃO     │
    │ APROVADA        │       │ RECUSADA        │  (fim)
    └────────┬────────┘       └─────────────────┘
             │ (auto ao aprovar)
             ▼
    ┌─────────────────┐
    │ EM PRODUÇÃO     │  ← Operador digitaliza / vincula upload
    └────────┬────────┘
             │
     ┌───────┴────────┐
     ▼                ▼
┌─────────────┐  ┌──────────────┐
│ ENVIADO     │  │ NÃO          │
│ AUDITORIA   │  │ LOCALIZADO   │
└──────┬──────┘  └──────────────┘
       │ Auditor
   ┌───┴────────────────┐
   ▼                    ▼
┌──────────────┐  ┌──────────────────┐
│ CORREÇÃO     │  │ APROVADO P/      │
│ SOLICITADA   │  │ ENTREGA          │
└──────┬───────┘  └────────┬─────────┘
       │ Operador corrige   │
       ▼                    ▼
┌──────────────┐  ┌──────────────────┐
│ CORRIGIDO →  │  │ PRONTO P/        │
│ volta audit. │  │ ENTREGA          │
└──────────────┘  └────────┬─────────┘
                           ▼
                  ┌──────────────────┐
                  │ ENTREGUE         │  (fim)
                  └──────────────────┘

Em qualquer etapa ativa: → CANCELADO (fim)
```

### Regras importantes

1. **Aprovar solicitação** → status vai automaticamente para **Em Produção** (dois passos em um clique).
2. **Upload vinculado** a solicitação aprovada/em produção → prontuário criado já em **Enviado para Auditoria**.
3. **Número do prontuário** gerado como `AAAAMMDD-XXXX` (data + 4 primeiros caracteres do token).
4. **Correção de arquivo** (`ResubmitModal`) com status `correction_needed` → volta para **Em Produção** após reenvio.
5. **`applyWorkflowTransition()`** em `storage.js` mantém solicitação e prontuário alinhados.

### Onde o fluxo é definido no código

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/lib/storage.js` | `STATUS_WORKFLOW`, `getAllowedTransitions()`, `applyWorkflowTransition()` |
| `src/pages/RevisorPage.jsx` | Transições do revisor + WhatsApp |
| `src/pages/UploadPage.jsx` | Vínculo solicitação → upload → auditoria |
| `src/pages/ProducaoPage.jsx` | Transições do operador |
| `src/pages/RevisaoPage.jsx` | Transições do auditor |
| `supabase/functions/workflow-webhook/` | API externa com o mesmo fluxo |

---

## Perfis de usuário e permissões

Existem **4 papéis** internos (`profiles.role`):

| Papel | Menu principal | Pode fazer |
|-------|----------------|------------|
| **admin** | Tudo | Qualquer transição de workflow; usuários; lixeira; estatísticas |
| **revisor** | Solicitações | Aprovar/recusar solicitações; encaminhar produção; WhatsApp |
| **operador** | Upload, Produção, Busca | Upload (com ou sem vínculo); mover produção; correções; entrega |
| **auditor** | Auditoria, Logs, Lixeira, Busca | Revisar documentos; solicitar correção; aprovar entrega |

### Matriz resumida

| Ação | Admin | Revisor | Operador | Auditor |
|------|:-----:|:-------:|:--------:|:-------:|
| Buscar prontuários | ✅ | ✅ | ✅ | ✅ |
| Upload de documentos | ✅ | ❌ | ✅ | ❌ |
| Painel solicitações (`/revisor`) | ✅ | ✅ | ❌ | ❌ |
| Produção (`/producao`) | ✅ | ❌ | ✅ | ❌ |
| Auditoria (`/revisao`) | ✅ | ❌ | ❌ | ✅ |
| Logs | ✅ | ❌ | ❌ | ✅ |
| Lixeira | ✅ | ❌ | ❌ | ✅ |
| Admin / usuários | ✅ | ❌ | ❌ | ❌ |

A proteção ocorre em **duas camadas**:

1. **Frontend** — componente `RequireAuth` em `App.jsx` e menus condicionais em `Layout.jsx`
2. **Backend** — políticas **RLS** no PostgreSQL (Supabase)

> Nunca confie só no frontend. Ao adicionar features, atualize também as políticas RLS.

---

## Rotas da aplicação

Definidas em `src/App.jsx`:

### Rotas públicas (sem login)

| Rota | Página | Descrição |
|------|--------|-----------|
| `/solicitacao` | `PatientRequestPage` | Formulário + PDF + upload assinado |
| `/acompanhamento` | `PatientTrackingPage` | Consulta por token |
| `/login` | `LoginPage` | Autenticação |
| `/reset-password` | `ResetPasswordPage` | Redefinição de senha |

### Rotas autenticadas (dentro de `Layout`)

| Rota | Página | Roles |
|------|--------|-------|
| `/busca` | `BuscaPage` | Todos autenticados |
| `/upload` | `UploadPage` | admin, operador |
| `/producao` | `ProducaoPage` | admin, operador |
| `/revisor` | `RevisorPage` | admin, revisor |
| `/revisao` | `RevisaoPage` | admin, auditor |
| `/logs` | `LogsPage` | admin, auditor |
| `/lixeira` | `LixeiraPage` | admin, auditor |
| `/admin` | `AdminPage` | admin |

---

## Modelo de dados

### Tabelas principais

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Perfil do usuário (nome, role, active) — ligado a `auth.users` |
| `prontuarios` | Documento digitalizado (metadados + `workflow_status` + arquivo) |
| `patient_requests` | Solicitação do paciente (token, dados, PDF assinado, workflow) |
| `audit_logs` | Trilha de auditoria (quem fez o quê) |
| `document_versions` | Histórico de versões de cada prontuário |
| `reviewer_notes` | Notas do revisor/auditor sobre um prontuário |
| `notifications` | Notificações in-app |
| `system_config` | Configurações globais (lixeira automática, etc.) |

### Vínculo solicitação ↔ prontuário

```
patient_requests                    prontuarios
├── id                              ├── id
├── token (único, 8 chars)          ├── record_number (AAAAMMDD-XXXX)
├── workflow_status  ◄────────────► ├── workflow_status
├── prontuario_id ─────────────────►├── patient_request_id
├── record_number                   ├── file_path (Storage)
└── signature_file_path             └── status (pending/approved/reproved — auditoria doc.)
```

### Dois tipos de “status” (não confundir)

| Campo | Onde | Significado |
|-------|------|-------------|
| `workflow_status` | `patient_requests` e `prontuarios` | Etapa do **processo** (recebida → entregue) |
| `status` | `prontuarios` | Resultado da **auditoria do documento** (`pending`, `approved`, `reproved`, `trash`) |
| `status` (legado) | `patient_requests` | Mantido para compatibilidade; derivado do workflow |

### Funções SQL úteis (RLS)

Criadas nas migrações `007` e seguintes:

- `is_admin()`, `is_revisor()`, `is_auditor()`, `is_operador()`
- `current_user_role()`
- `get_patient_request_by_token(token)` — acompanhamento público
- `update_patient_request_signature(token, path)` — upload anônimo do PDF assinado

---

## Estrutura do projeto

```
meddoc/                          ← RAIZ — aplicação em produção
│
├── src/
│   ├── App.jsx                  ← Rotas + guards por role
│   ├── main.jsx                 ← Entry point (Tailwind + global.css)
│   │
│   ├── lib/
│   │   └── storage.js           ← ★ CAMADA CENTRAL: Supabase, workflow, serviços
│   │
│   ├── hooks/
│   │   ├── useAuth.jsx          ← Sessão e perfil do usuário
│   │   ├── useAuditLog.js       ← Registro de ações
│   │   └── useNotifications.js  ← Sininho de notificações
│   │
│   ├── components/
│   │   ├── Layout.jsx           ← Navbar + sidebar + notificações
│   │   ├── UI.jsx               ← Botões, campos, modais reutilizáveis
│   │   ├── ResubmitModal.jsx    ← Reenvio de correção de arquivo
│   │   └── ProntuarioNotes.jsx  ← Notas em prontuários
│   │
│   ├── pages/                   ← Uma pasta por tela
│   │   ├── PatientRequestPage.jsx    (público — Tailwind)
│   │   ├── PatientTrackingPage.jsx   (público — Tailwind)
│   │   ├── RevisorPage.jsx           (solicitações)
│   │   ├── UploadPage.jsx
│   │   ├── ProducaoPage.jsx
│   │   ├── RevisaoPage.jsx
│   │   ├── BuscaPage.jsx
│   │   ├── LogsPage.jsx
│   │   ├── LixeiraPage.jsx
│   │   ├── AdminPage.jsx
│   │   └── *.module.css         ← Estilos escopados por página
│   │
│   └── styles/
│       ├── global.css           ← Variáveis CSS, reset, utilitários
│       └── tailwind.css         ← Diretivas @tailwind
│
├── supabase/
│   ├── migrations/              ← Scripts SQL (rodar em ordem no Supabase)
│   └── functions/               ← Edge Functions (Deno)
│       ├── invite-user/
│       ├── admin-actions/
│       ├── workflow-webhook/
│       └── cron-clean-trash/
│
├── public/                      ← favicon, assets estáticos
├── dist/                        ← Build de produção (gerado por Vite)
│
├── server.cjs                   ← Express: serve dist/ + /health
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── render.yaml                  ← Blueprint Render
├── package.json
└── .env.example                 ← Variáveis necessárias
```

### Arquivo mais importante: `storage.js`

Tudo que fala com o Supabase passa por aqui. Serviços exportados:

| Serviço | Função |
|---------|--------|
| `authService` | Login, logout, sessão |
| `profilesService` | Perfis, convites, admin |
| `prontuariosService` | CRUD, upload, versionamento, resubmit |
| `patientRequestsService` | Solicitações de pacientes |
| `workflowService` | Atualização de workflow em prontuários |
| `logsService` | Logs + export CSV/XLSX |
| `storageService` | Upload/download no bucket |
| `notificationsService` | Notificações |
| `reviewerNotesService` | Notas |
| `applyWorkflowTransition` | Sincroniza solicitação + prontuário |
| `getAllowedTransitions` | Valida o que cada role pode fazer |
| `generateRecordNumber` | Gera `AAAAMMDD-XXXX` |

**Para trocar de backend** (Firebase, Appwrite, API própria): reimplemente os exports de `storage.js`. As páginas React não precisam mudar.

---

## Como rodar localmente

### Pré-requisitos

- **Node.js 18+** (recomendado 20)
- Conta **Supabase** com projeto criado
- Git

### Passos

```bash
# 1. Clonar
git clone https://github.com/SEU_USUARIO/meddoc.git
cd meddoc

# 2. Instalar dependências
npm install

# 3. Configurar ambiente
cp .env.example .env
# Edite .env com URL e anon key do Supabase

# 4. Subir o dev server
npm run dev
```

Abra o endereço que o Vite mostrar (geralmente `http://localhost:5173`).

### Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento com hot reload |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Pré-visualiza o build localmente |

### Testar build de produção localmente

```bash
npm run build
node server.cjs
# Acesse http://localhost:10000
```

### Usuários de demonstração

Após rodar `005_seed_demo_v2.sql`, crie estes usuários em **Auth → Users** (marque *Auto Confirm*):

| E-mail | Senha | Papel |
|--------|-------|-------|
| `admin@meddoc.local` | `Admin@123` | admin |
| `auditor@meddoc.local` | `Auditor@123` | auditor |
| `revisor@meddoc.local` | `Revisor@123` | revisor |
| `operador@meddoc.local` | `Operador@123` | operador |

---

## Configurar o Supabase

### 1. Criar projeto

1. [supabase.com](https://supabase.com) → **New project**
2. Anote **Project URL** e **anon public key** → `.env`

### 2. Rodar migrações (SQL Editor)

Execute **na ordem abaixo**. Se o banco já existir, pule as que já foram aplicadas.

| Ordem | Arquivo | O que faz |
|-------|---------|-----------|
| 1 | `001_initial_schema.sql` | Schema base, RLS, storage bucket |
| 2 | `004_roles_refactor.sql` | Papéis admin/auditor/revisor/operador + workflow |
| 3 | `003_add_missing_columns.sql` | Colunas extras em prontuários |
| 4 | `006_workflow_enhancement.sql` | Melhorias de workflow |
| 5 | `007_update_de RLS_e_Permissões.sql` | Funções RLS (`is_revisor`, etc.) |
| 6 | `migration_notes_notifications.sql` | Notas e notificações |
| 7 | `008_patient_requests.sql` | Tabela de solicitações de pacientes |
| 8 | `009_fix_patient_requests_rls.sql` | Correção RLS das solicitações |
| 9 | `010_unified_patient_workflow.sql` | Workflow unificado + RPCs públicas |
| 10 | `011_dashboard_workflow_stats.sql` | View `dashboard_stats` atualizada |

**Opcionais:**

- `002_seed_demo.sql` / `005_seed_demo_v2.sql` — dados e usuários demo
- `003_cloudflare_r2_notes.sql` — guia para storage externo

> Arquivos `001_schema.sql` e `001_initial_schema.sql` são variantes do schema inicial — use **apenas um** em instalações novas.

### 3. Storage

O bucket `prontuarios` deve existir (criado na migração inicial). Pastas comuns:

- `{user_id}/...` — uploads de operadores
- `patient_requests/{token}_signed.pdf` — PDFs assinados pelos pacientes

### 4. Primeiro administrador

1. **Authentication → Users → Add user**
2. Copie o UUID
3. SQL Editor:

```sql
UPDATE profiles
SET role = 'admin', name = 'Seu Nome'
WHERE id = 'cole-o-uuid-aqui';
```

### 5. Variáveis de ambiente

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> Variáveis com prefixo `VITE_` são embutidas no build pelo Vite. No Render, configure-as **antes** do deploy.

---

## Deploy em produção

### Render (recomendado)

1. [render.com](https://render.com) → **New → Web Service**
2. Conecte o repositório GitHub
3. Configuração:
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `node server.cjs`
   - **Plan:** Free
4. **Environment Variables:**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `NODE_ENV=production`
5. Deploy automático a cada push em `main`

Ou use o blueprint `render.yaml` na raiz.

### UptimeRobot (manter Render acordado)

| Campo | Valor |
|-------|-------|
| URL | `https://seu-app.onrender.com/health` |
| Intervalo | 5 minutos |

### GitHub Actions

O workflow `.github/workflows/deploy.yml`:

- Roda `npm run build` em PRs e pushes
- Usa secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- O Render faz redeploy ao detectar push em `main`

---

## Edge Functions

Funções serverless em `supabase/functions/` (runtime Deno):

| Função | Propósito |
|--------|-----------|
| `invite-user` | Convida usuário por e-mail pelo painel admin |
| `admin-actions` | Ações administrativas (reset senha, desativar, etc.) |
| `workflow-webhook` | API HTTP para sistemas externos atualizarem workflow |
| `cron-clean-trash` | Limpeza automática da lixeira (agendar no Supabase) |

### Deploy

```bash
npm install -g supabase
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy invite-user
supabase functions deploy workflow-webhook
# ... demais funções
```

### Webhook de workflow (exemplo)

```bash
curl -X POST https://SEU_PROJETO.supabase.co/functions/v1/workflow-webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: SEU_SECRET" \
  -d '{
    "token": "ABCD1234",
    "workflow_status": "request_approved",
    "caller_role": "revisor",
    "note": "Aprovado via integração"
  }'
```

Com `auto_production_on_approve: true` (padrão), aprovação também move para **Em Produção**.

---

## Guia para desenvolver e estender

### Adicionar um novo status de workflow

1. **`storage.js`** — inclua em `STATUS_WORKFLOW`
2. **`ALLOWED_TRANSITIONS_BY_ROLE`** — defina quem pode mover para/de esse status
3. **`SHARED_LATE_TRANSITIONS`** — se for status compartilhado no fim do fluxo
4. **Migração SQL** — `ALTER TYPE workflow_status ADD VALUE` e/ou `CHECK` em `patient_requests`
5. **Páginas** — filtros em `ProducaoPage`, `RevisaoPage`, `RevisorPage`, `AdminPage`
6. **`notifyWorkflowChange`** — quem deve ser notificado
7. **`workflow-webhook/index.ts`** — manter paridade com o frontend

### Adicionar uma nova página interna

```text
1. Criar src/pages/MinhaPage.jsx + MinhaPage.module.css
2. Importar em App.jsx e adicionar <Route>
3. Se restrita: envolver com <RequireAuth roles={[...]}>
4. Adicionar link em Layout.jsx (condicional ao role)
5. Se acessar dados: usar serviços de storage.js
6. Se nova tabela: criar migração + políticas RLS
```

### Adicionar campo na solicitação do paciente

1. Coluna na migração SQL (`patient_requests`)
2. Formulário em `PatientRequestPage.jsx`
3. `patientRequestsService.create()` — incluir o campo
4. Exibição em `RevisorPage.jsx` e `PatientTrackingPage.jsx`

### Registrar ação no log de auditoria

```javascript
import { useAuditLog } from '../hooks/useAuditLog'

const log = useAuditLog()
await log('workflow_update', 'Descrição legível da ação', prontuarioId)
```

Tipos em `audit_action` enum: `upload`, `download`, `approved`, `workflow_update`, `resubmit`, etc.

### Boas práticas do projeto

- **Mudanças de workflow** → sempre usar `applyWorkflowTransition()`, nunca atualizar só uma tabela
- **Upload vinculado** → passar `patient_request_id` em `createWithVersion()`
- **Estilo interno** → preferir CSS Modules (`*.module.css`), não Tailwind
- **Rotas públicas** → Tailwind já configurado em `tailwind.config.js`
- **Segurança** → toda tabela nova precisa de RLS antes de ir para produção

---

## Estilização (CSS Modules + Tailwind)

O projeto usa **duas estratégias** de CSS de propósito:

| Área | Tecnologia | Arquivos |
|------|------------|----------|
| Painel interno (login, busca, upload…) | **CSS Modules** | `src/pages/*.module.css`, `src/components/*.module.css` |
| Portal do paciente | **Tailwind CSS** | classes utilitárias em `PatientRequestPage`, `PatientTrackingPage` |

Variáveis globais de design (`--accent`, `--surface`, etc.) estão em `src/styles/global.css`.

Ordem de import em `main.jsx`:

```javascript
import './styles/tailwind.css'  // primeiro — base Tailwind
import './styles/global.css'  // depois — tema MedDoc
```

---

## Solução de problemas

| Problema | Causa provável | Solução |
|--------|----------------|---------|
| Tela branca ao iniciar | `.env` ausente ou inválido | Copie `.env.example` → `.env` com credenciais corretas |
| Build falha no Render | Env vars não definidas | Configure `VITE_*` no dashboard **antes** do build |
| Paciente não acha solicitação | Migração 010 não aplicada | Rode `010_unified_patient_workflow.sql` (RPC pública) |
| Erro ao atualizar status | RLS desatualizado | Rode `009` e `010` |
| Estilo quebrado em `/solicitacao` | Tailwind não processado | Verifique `postcss.config.js` e `tailwind.config.js` |
| Upload não vai para auditoria | Solicitação não vinculada | Selecione solicitação no dropdown do Upload |
| Render “dorme” | Plano Free sem tráfego | Configure UptimeRobot em `/health` |
| `duplicate key` no upload | `record_number` já existe | Número é único; use vínculo com solicitação |

### Logs úteis

- **Browser** — DevTools → Console e Network
- **Supabase** — Dashboard → Logs → Postgres / API
- **Render** — Dashboard → Logs do serviço

---

## Licença

MIT — use, modifique e distribua livremente.

---

## Contribuindo

1. Fork do repositório
2. Branch: `git checkout -b feat/minha-feature`
3. `npm run build` deve passar sem erros
4. Pull Request para `main` com descrição clara do que mudou

Dúvidas sobre o fluxo? Comece lendo `src/lib/storage.js` (workflow) e `src/App.jsx` (rotas). São os dois melhores pontos de entrada para entender o sistema inteiro.
