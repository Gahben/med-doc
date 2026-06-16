# MedDoc - Gestão de Solicitações e Prontuários Médicos

O **MedDoc** é uma aplicação web para hospitais, clínicas e equipes administrativas que precisam receber solicitações de cópia de prontuário, acompanhar a produção/digitalização, auditar arquivos antes da entrega e manter rastreabilidade das ações realizadas no processo.

Este repositório contém duas bases de aplicação:

- **Aplicação ativa na raiz**: SPA React com Vite, servida em produção por um servidor Node/Express mínimo. É a versão mais completa e documentada neste README.
- **Aplicação Next.js em `meddoc/`**: implementação paralela/protótipo em Next.js 14 com TypeScript, rotas API e NextAuth. Ela continua no repositório, mas não é a aplicação principal configurada no `render.yaml` da raiz.

## Sumário

- [Visão geral](#visão-geral)
- [Stack principal](#stack-principal)
- [Arquitetura](#arquitetura)
- [Funcionalidades](#funcionalidades)
- [Perfis e permissões](#perfis-e-permissões)
- [Rotas da aplicação React](#rotas-da-aplicação-react)
- [Fluxo de trabalho](#fluxo-de-trabalho)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Como rodar localmente](#como-rodar-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Supabase](#supabase)
- [Edge Functions](#edge-functions)
- [IA e evidências de avaliação](#ia-e-evidências-de-avaliação)
- [Automações n8n](#automações-n8n)
- [Testes](#testes)
- [Deploy](#deploy)
- [Aplicação Next.js em meddoc/](#aplicação-nextjs-em-meddoc)
- [Pontos de atenção](#pontos-de-atenção)

## Visão geral

O sistema cobre dois fluxos conectados:

| Área | Quem usa | O que faz |
| --- | --- | --- |
| Portal público | Paciente ou responsável | Abre solicitação, gera documento para assinatura, envia PDF assinado e acompanha o andamento por token |
| Painel interno | Admin, revisor, operador e auditor | Revisa solicitações, produz/digitaliza prontuários, audita documentos, entrega ao paciente e registra logs |

A aplicação principal é uma SPA. O navegador conversa diretamente com o Supabase para autenticação, banco, storage e Edge Functions. O servidor Express da raiz não implementa API de negócio; ele serve o build Vite e expõe endpoints simples de saúde.

## Stack principal

### Frontend ativo

- React 18
- Vite 6
- React Router 7
- CSS Modules para telas internas
- Tailwind CSS 3 para telas públicas
- Supabase JS
- react-dropzone
- react-hot-toast
- lucide-react
- framer-motion
- jsPDF
- pdf-lib
- xlsx
- date-fns

### Backend e infraestrutura

- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Edge Functions em Deno
- Row Level Security (RLS)
- Node.js/Express para servir `dist/`
- Render para deploy
- GitHub Actions para CI
- n8n para automações externas
- Google Gemini nas Edge Functions de IA

### Base Next.js em `meddoc/`

- Next.js 14 App Router
- TypeScript
- NextAuth
- Supabase SSR/client
- Tailwind CSS
- Radix UI

## Arquitetura

```text
Paciente / equipe interna
        |
        v
React SPA (Vite, React Router)
        |
        +--> Supabase Auth
        +--> Supabase PostgreSQL + RLS
        +--> Supabase Storage
        +--> Supabase Edge Functions
        |
        v
Render Web Service
server.cjs -> dist/ + /health + /ping
```

O arquivo mais importante da aplicação ativa é `src/lib/storage.js`. Ele concentra a integração com Supabase e exporta os serviços usados pelas páginas:

- `authService`
- `profilesService`
- `prontuariosService`
- `patientRequestsService`
- `workflowService`
- `documentVersionsService`
- `logsService`
- `storageService`
- `notificationsService`
- `reviewerNotesService`
- `prontuarioNotesService`
- `systemConfigService`
- `emailService`
- `aiService`
- helpers de CPF, hash, paginação de PDF e transição de workflow

## Funcionalidades

- Solicitação pública de cópia de prontuário em `/solicitacao`
- Acompanhamento público por token em `/acompanhamento`
- Login por e-mail/senha via Supabase Auth
- Login com Google OAuth, se configurado no Supabase
- Recuperação e redefinição de senha
- Painel interno com layout autenticado
- Busca de prontuários por paciente, CPF e número de registro
- Upload de documentos por operador/admin
- Geração de número de prontuário no formato `AAAAMMDD-XXXX`
- Validação, formatação e máscara de CPF
- Upload no bucket `prontuarios`
- Detecção de duplicidade por hash SHA-256
- Contagem de páginas para PDFs com `pdf-lib`
- Versionamento de uploads e reenvios
- Soft delete para lixeira
- Exclusão permanente com remoção de versões no storage
- Logs de auditoria com exportação CSV/XLSX
- Notificações in-app por polling
- Notas compartilhadas de prontuário com menções
- Convite e administração de usuários por Edge Function
- Workflow unificado entre `patient_requests` e `prontuarios`
- Triagem de solicitações por IA
- Checklist de auditoria por IA
- Geração de mensagem WhatsApp por IA
- Workflows n8n em `n8n-workflows/` para resumo semanal e detecção de anomalias

## Perfis e permissões

| Perfil | Acesso principal |
| --- | --- |
| `admin` | Acesso total ao painel, usuários, estatísticas, logs, lixeira e mudanças de workflow |
| `revisor` | Revisão de solicitações recebidas, aprovação/recusa e contato com paciente |
| `operador` | Upload, produção, correção e encaminhamento para auditoria |
| `auditor` | Revisão de qualidade, logs e lixeira |
| Público | Solicitação e acompanhamento por token, sem login |

As permissões são aplicadas em três camadas:

- rotas protegidas no React (`RequireAuth` em `src/App.jsx`);
- regras de transição em `src/lib/storage.js`;
- políticas RLS nas migrations do Supabase.

## Rotas da aplicação React

| Rota | Tipo | Acesso |
| --- | --- | --- |
| `/solicitacao` | Pública | Paciente/responsável |
| `/acompanhamento` | Pública | Paciente/responsável com token |
| `/login` | Pública | Usuários internos |
| `/reset-password` | Pública | Usuários internos |
| `/` | Protegida | Redireciona para `/busca` |
| `/busca` | Protegida | Usuário autenticado |
| `/upload` | Protegida | `admin`, `operador` |
| `/producao` | Protegida | `admin`, `operador` |
| `/revisao` | Protegida | `admin`, `auditor` |
| `/logs` | Protegida | `admin`, `auditor` |
| `/revisor` | Protegida | `admin`, `revisor` |
| `/lixeira` | Protegida | `admin`, `auditor` |
| `/admin` | Protegida | `admin` |

## Fluxo de trabalho

O workflow principal é controlado por `workflow_status`.

```text
received
  -> request_approved
      -> in_production
          -> in_audit
              -> correction_needed
                  -> corrected
                      -> in_audit
              -> concluded
                  -> ready_for_delivery
                      -> delivered
  -> request_rejected

Qualquer etapa ativa pode ir para cancelled conforme as regras de perfil.
```

### Papéis no fluxo

| Etapa | Perfil típico | Ação |
| --- | --- | --- |
| `received` | Revisor | Analisa a solicitação inicial |
| `request_approved` | Revisor/operador | Libera para produção |
| `in_production` | Operador | Digitaliza ou localiza o documento |
| `in_audit` | Auditor | Revisa qualidade/metadados |
| `correction_needed` | Operador | Corrige e reenvia |
| `concluded` | Operador/admin | Prepara entrega |
| `ready_for_delivery` | Operador/admin | Finaliza entrega |
| `delivered` | Sistema/equipe | Encerramento |

`applyWorkflowTransition()` sincroniza, quando possível, a solicitação (`patient_requests`) e o prontuário (`prontuarios`) vinculados.

## Estrutura do repositório

```text
.
├── src/                         # Aplicação React/Vite ativa
│   ├── components/              # Layout, UI, modal de reenvio, notas
│   ├── hooks/                   # Auth, audit log, notificações
│   ├── lib/                     # storage.js e testes de CPF
│   ├── pages/                   # Páginas públicas e internas
│   └── styles/                  # Tailwind e CSS global
├── supabase/
│   ├── migrations/              # Schema, RLS, workflow, IA e storage policies
│   ├── functions/               # Edge Functions da aplicação ativa
│   └── config.toml              # Config local do Supabase CLI
├── docs/
│   └── edge-functions.md        # Documentação detalhada das Edge Functions
├── tests/
│   └── ai_triage/               # Dataset e relatório de avaliação da triagem IA
├── n8n-workflows/               # Workflows n8n usando HTTP nativo
├── meddoc/                      # Aplicação Next.js paralela/protótipo
├── public/                      # Assets públicos
├── server.cjs                   # Servidor Express para produção da SPA
├── render.yaml                  # Blueprint Render da aplicação ativa
├── package.json                 # Scripts e dependências da aplicação ativa
└── README.md
```

## Como rodar localmente

Pré-requisitos:

- Node.js 18+ (Node 20 recomendado)
- npm
- Projeto Supabase configurado
- Credenciais `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`

Passos:

```bash
npm install
cp .env.example .env
npm run dev
```

Abra a URL exibida pelo Vite, normalmente `http://localhost:5173`.

### Scripts da raiz

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o Vite em modo desenvolvimento |
| `npm run build` | Gera build em `dist/` |
| `npm run preview` | Serve o build pelo Vite Preview |
| `npm test` | Executa testes com Vitest |

### Testar o servidor de produção local

```bash
npm run build
node server.cjs
```

O servidor usa `PORT` quando definido; caso contrário, sobe em `10000`.

Endpoints do servidor:

- `GET /health`
- `GET /ping`
- arquivos estáticos de `dist/`
- fallback para `index.html` nas rotas da SPA

## Variáveis de ambiente

Arquivo base: `.env.example`

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

Observações:

- Variáveis `VITE_*` são embutidas no build do frontend.
- A anon key do Supabase pode ficar no frontend, desde que o banco esteja protegido por RLS.
- Edge Functions de IA usam secrets configurados no Supabase, não no `.env` da SPA.

Secrets esperados pelas Edge Functions:

```bash
supabase secrets set GEMINI_API_KEY=sua-chave
supabase secrets set WORKFLOW_WEBHOOK_SECRET=seu-segredo
```

`WORKFLOW_WEBHOOK_SECRET` é usado pelo `workflow-webhook`. `GEMINI_API_KEY` é usado pelas funções de IA.

## Supabase

### Migrations existentes

A pasta `supabase/migrations/` contém a evolução do banco:

- schemas iniciais;
- refatoração de papéis;
- colunas complementares;
- melhorias de workflow;
- políticas RLS;
- notas e notificações;
- solicitações públicas de pacientes;
- workflow unificado;
- estatísticas de dashboard;
- tabelas de resultados de IA;
- política de upload público para PDF assinado;
- campo `prontuario_notes` na triagem IA.

Arquivos encontrados:

```text
001_initial_schema.sql
001_schema.sql
002_seed_demo.sql
003_add_missing_columns.sql
003_cloudflare_r2_notes.sql
004_roles_refactor.sql
005_seed_demo_v2.sql
006_workflow_enhancement.sql
007_update_de RLS_e_Permissões.sql
008_patient_requests.sql
009_fix_patient_requests_rls.sql
010_unified_patient_workflow.sql
011_dashboard_workflow_stats.sql
012_ai_triage_results.sql
013_storage_public_upload_policy.sql
014_add_prontuario_notes_to_ai_triage.sql
migration_notes_notifications.sql
```

Em uma instalação nova, aplique as migrations em ordem lógica e use apenas uma variante de schema inicial (`001_initial_schema.sql` ou `001_schema.sql`) se houver sobreposição no seu ambiente.

### Storage

Bucket principal esperado:

```text
prontuarios
```

Usos principais:

- uploads internos de prontuários;
- versões de documentos;
- PDFs assinados enviados por pacientes;
- remoção de arquivos durante exclusão permanente.

### Autenticação

A aplicação ativa usa Supabase Auth diretamente no frontend:

- e-mail/senha;
- Google OAuth opcional;
- reset de senha.

O perfil e o papel de acesso ficam na tabela `profiles`.

## Edge Functions

As funções da aplicação ativa ficam em `supabase/functions/`:

| Função | Finalidade |
| --- | --- |
| `invite-user` | Convite de usuários pelo admin |
| `admin-actions` | Reset de senha, atualização de papel/status e ações administrativas |
| `workflow-webhook` | Atualização externa de workflow por webhook com segredo |
| `cron-clean-trash` | Limpeza automática de prontuários na lixeira |
| `ai-triage` | Triagem de urgência de solicitações com Gemini |
| `ai-audit-checklist` | Checklist/anomalias de auditoria com Gemini |
| `ai-whatsapp-message` | Geração de mensagem para WhatsApp com Gemini |

A documentação detalhada de payloads e respostas está em `docs/edge-functions.md`.

Deploy típico:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy invite-user
supabase functions deploy admin-actions
supabase functions deploy workflow-webhook
supabase functions deploy cron-clean-trash
supabase functions deploy ai-triage
supabase functions deploy ai-audit-checklist
supabase functions deploy ai-whatsapp-message
```

## IA e evidências de avaliação

O projeto usa **Google Gemini** nas Edge Functions:

- `ai-triage`: classifica urgência (`low`, `medium`, `high`, `critical`), resume a solicitação e aponta inconsistências;
- `ai-audit-checklist`: avalia metadados e histórico de versões para alertas de auditoria;
- `ai-whatsapp-message`: redige mensagens profissionais para contato com o paciente.

Há evidência local de avaliação da triagem em:

- `tests/ai_triage/dataset.json`
- `tests/ai_triage/REPORT.md`
- `tests/ai_triage/triageAccuracy.test.js`

O relatório registra 50 casos simulados em português e 48 classificações corretas, resultando em **96% de acurácia**. O teste automatizado atual valida a estrutura e integridade do dataset; ele não executa chamadas reais ao Gemini durante `npm test`.

## Automações n8n

O repositório mantém apenas a pasta `n8n-workflows/`, com workflows importáveis no n8n usando nós HTTP nativos.

| Arquivo | Descrição |
| --- | --- |
| `Anomaly_Detection_Native.json` | Detecção de anomalias usando nós HTTP nativos |
| `Weekly_Summary_Native.json` | Resumo semanal usando nós HTTP nativos |

Os workflows devem ser importados no n8n e configurados com as credenciais/URLs do ambiente Supabase em uso.

## Testes

Framework configurado: Vitest.

Testes existentes:

- `src/lib/cpfHelpers.test.js`: valida helpers de CPF exportados por `storage.js`;
- `tests/ai_triage/triageAccuracy.test.js`: valida dataset de avaliação da triagem IA.

Comando:

```bash
npm test
```

Importante: `cpfHelpers.test.js` importa `src/lib/storage.js`, e esse módulo exige `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no carregamento. Para rodar a suíte, mantenha `.env` configurado.

## Deploy

### Render

O deploy principal da raiz usa `render.yaml`:

```yaml
buildCommand: npm ci && npm run build
startCommand: node server.cjs
```

Variáveis no Render:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
NODE_ENV=production
```

Health check recomendado:

```text
/health
```

### GitHub Actions

Workflows existentes:

- `.github/workflows/deploy.yml`
- `.github/workflows/deploy_win.yml`

Ambos rodam em pushes e pull requests para `main`, instalam dependências com `npm ci`, executam `npm run build` com Node 20 e publicam `dist/` como artifact temporário.

O Render faz o redeploy automaticamente quando detecta push no branch configurado.

### Script Windows

`compilador_win.bat` automatiza fluxo local de build/deploy para Windows. Revise o conteúdo antes de usar, porque scripts desse tipo podem incluir commit/push.

## Aplicação Next.js em meddoc/

A pasta `meddoc/` contém outra aplicação:

```text
meddoc/
├── src/app/                 # App Router
├── src/app/api/             # API routes
├── src/components/          # Providers/componentes
├── src/lib/                 # Supabase/auth/utils
├── src/types/               # Tipos TypeScript
├── supabase/schema.sql      # Schema próprio da base Next
├── supabase/functions/      # move-to-trash e permanent-delete
├── package.json
└── render.yaml
```

Scripts:

```bash
cd meddoc
npm install
npm run dev
npm run build
npm start
```

Rotas e áreas encontradas:

- `/login`
- `/dashboard`
- `/dashboard/busca`
- `/dashboard/upload`
- `/dashboard/revisao`
- `/dashboard/usuarios`
- `/dashboard/logs`
- `/dashboard/config`
- APIs em `/api/auth`, `/api/documents`, `/api/review`, `/api/admin/*`, `/api/health`

Variáveis esperadas pela base Next.js, conforme `meddoc/README.md` e `meddoc/render.yaml`:

```text
NEXTAUTH_SECRET
NEXTAUTH_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
```

Essa base tem `render.yaml` próprio com health check em `/api/health`, mas não é o deploy principal descrito pelo `render.yaml` da raiz.

## Pontos de atenção

- Há arquivos com texto corrompido por encoding em comentários/documentos antigos. Este README foi reescrito em português legível.
- A aplicação ativa não possui backend REST próprio para regras de negócio; a maior parte do acesso acontece via Supabase JS e Edge Functions.
- O teste de acurácia da IA não chama o provedor real; ele valida o dataset e acompanha o relatório de evidência.
- O repositório contém `dist/` e `node_modules/` no ambiente local atual, mas eles são artefatos/dependências geradas.
- Existem duas bases com stacks diferentes. Para desenvolvimento da versão atual, trabalhe primeiro na raiz (`src/`, `supabase/`, `server.cjs`).
