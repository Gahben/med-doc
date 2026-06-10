# MedDoc - Repositório de Prontuários Médicos

Sistema web completo para gestão de prontuários médicos digitais, com fluxo de upload, revisão, aprovação e busca de documentos. Desenvolvido com foco em conformidade com a LGPD.

## 🚀 Stack Tecnológica

- **Frontend + Backend:** Next.js 14 (App Router) com TypeScript
- **Banco de Dados:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage
- **Autenticação:** NextAuth.js com bcrypt
- **Hospedagem:** Render (Web Service free tier)
- **UI:** Tailwind CSS + shadcn/ui

## 📋 Funcionalidades

### Perfis de Usuário
- **Admin:** Gerencia usuários, configurações, visualiza logs
- **Revisor:** Aprova/reprova prontuários na fila de revisão
- **Atendente:** Faz upload de prontuários, acompanha status

### Fluxos Principais
1. **Upload (Atendente):** Upload de PDF/JPG/PNG até 20MB com metadados do paciente
2. **Revisão (Revisor):** Fila de documentos pendentes com aprovação/reprovação
3. **Busca:** Busca unificada por nome, CPF ou código
4. **Download/Impressão:** Apenas documentos aprovados

### Ciclo de Vida Automático
- Documentos sem acesso por 180 dias → Lixeira
- Documentos na lixeira por 60 dias → Exclusão permanente
- Alerta para documentos pendentes há mais de 24h

## 🛠️ Configuração Local

### 1. Clone e Instalação

```bash
git clone <repository-url>
cd meddoc
npm install
```

### 2. Configurar Variáveis de Ambiente

```bash
cp .env.example .env.local
```

Edite `.env.local` com suas credenciais:

```env
NEXTAUTH_SECRET=sua_chave_secreta_aqui
NEXTAUTH_URL=http://localhost:3000
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
SUPABASE_ANON_KEY=sua_anon_key
```

### 3. Configurar Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Execute o script SQL em `supabase/schema.sql` no SQL Editor
3. Crie o Storage Bucket:
   - Nome: `medical-documents`
   - Public: false
   - Configure as políticas de acesso

### 4. Criar Usuário Admin Inicial

No SQL Editor do Supabase, execute:

```sql
-- Senha: admin123 (altere após primeiro login)
INSERT INTO users (email, name, role, password_hash, active)
VALUES (
  'admin@clinica.com', 
  'Administrador', 
  'admin', 
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiAYMyzJ/I2K', 
  true
);
```

### 5. Rodar o Projeto

```bash
npm run dev
```

Acesse: http://localhost:3000

Credenciais padrão:
- Email: `admin@clinica.com`
- Senha: `admin123`

## 🌐 Deploy no Render

### 1. Criar Web Service

1. Acesse [Render](https://render.com) e faça login
2. Clique em "New" → "Web Service"
3. Conecte seu repositório Git
4. Configure:
   - **Name:** meddoc
   - **Environment:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free

### 2. Configurar Variáveis de Ambiente

No dashboard do Render, adicione as Environment Variables:

```
NEXTAUTH_SECRET=<gerar_random_32_chars>
NEXTAUTH_URL=https://meddoc.onrender.com
SUPABASE_URL=<sua_url>
SUPABASE_SERVICE_ROLE_KEY=<sua_key>
SUPABASE_ANON_KEY=<sua_key>
```

> **Dica:** Use `openssl rand -base64 32` para gerar o NEXTAUTH_SECRET

### 3. Health Check

O Render usará automaticamente `/api/health` para verificar a saúde do serviço.

### 4. UptimeRobot (Opcional)

Para manter o serviço acordado no plano gratuito:

1. Crie conta no [UptimeRobot](https://uptimerobot.com)
2. Add New Monitor → HTTP(s)
3. Configure:
   - **Friendly Name:** MedDoc Health
   - **URL:** `https://seu-app.onrender.com/api/health`
   - **Monitoring Interval:** 5 minutes

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais

**users**
- id, email, name, role, password_hash, active, created_at, last_login

**documents**
- id, patient_name, cpf, prontuario_code, system_code, document_date
- type, origin_sector, file_url, file_size, file_hash
- uploaded_by, status, review_note, reviewed_by, reviewed_at
- never_delete, created_at, updated_at

**document_versions**
- id, document_id, version_number, file_url, status, review_note, created_at

**access_logs**
- id, user_id, action, document_id, details, ip_address, created_at

**system_config**
- id, trash_after_days, permanent_delete_after_days, alert_review_hours

## 🔒 Segurança e LGPD

- Autenticação com JWT (8h de expiração)
- Senhas hasheadas com bcrypt
- Row Level Security (RLS) no Supabase
- Soft delete (nunca apaga registros, apenas marca status)
- Logs de auditoria de todas as ações
- Controle de acesso por perfil de usuário

## 📁 Estrutura do Projeto

```
/meddoc
├── /src
│   ├── /app                    # Next.js App Router
│   │   ├── /api               # API Routes
│   │   │   ├── /auth          # Login/logout (NextAuth)
│   │   │   ├── /documents     # CRUD documentos
│   │   │   ├── /review        # Ações de revisão
│   │   │   ├── /admin         # Gestão de usuários/config
│   │   │   └── /health        # Health check
│   │   ├── /login             # Página de login
│   │   ├── /dashboard         # Área logada
│   │   │   ├── /busca         # Busca de prontuários
│   │   │   ├── /upload        # Upload de documentos
│   │   │   ├── /revisao       # Fila de revisão
│   │   │   ├── /usuarios      # Gestão de usuários
│   │   │   ├── /logs          # Logs de auditoria
│   │   │   └── /config        # Configurações
│   │   ├── layout.tsx         # Layout principal
│   │   └── globals.css        # Estilos globais
│   ├── /components            # Componentes React
│   ├── /lib                   # Utilitários, Supabase client
│   ├── /hooks                 # Custom hooks
│   └── /types                 # TypeScript types
├── /supabase
│   └── schema.sql             # Schema do banco
├── .env.example               # Exemplo de variáveis
├── render.yaml                # Config do Render
└── package.json
```

## 🔄 Jobs Automáticos (Ciclo de Vida)

Para implementar os jobs automáticos, configure funções Edge no Supabase:

```sql
-- Função para mover documentos antigos para lixeira
CREATE OR REPLACE FUNCTION move_to_trash_job()
RETURNS void AS $$
BEGIN
    UPDATE documents
    SET status = 'trash', updated_at = NOW()
    WHERE status = 'approved'
    AND never_delete = false
    AND (last_accessed_at IS NULL OR last_accessed_at < NOW() - INTERVAL '180 days');
END;
$$ LANGUAGE plpgsql;

-- Função para excluir documentos da lixeira
CREATE OR REPLACE FUNCTION permanent_delete_job()
RETURNS void AS $$
DECLARE
    doc RECORD;
BEGIN
    FOR doc IN 
        SELECT id, file_url 
        FROM documents 
        WHERE status = 'trash' 
        AND never_delete = false
        AND updated_at < NOW() - INTERVAL '60 days'
    LOOP
        -- Delete from storage (requires storage admin)
        -- DELETE FROM storage.objects WHERE name = ...
        
        -- Delete record
        DELETE FROM documents WHERE id = doc.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

## 🐛 Troubleshooting

### Erro de conexão com Supabase
- Verifique as credenciais em `.env.local`
- Confirme se o projeto Supabase está ativo
- Verifique as políticas RLS

### Erro de autenticação
- Verifique `NEXTAUTH_SECRET` e `NEXTAUTH_URL`
- Limpe os cookies do navegador
- Verifique se o usuário existe e está ativo

### Upload falhando
- Verifique se o bucket `medical-documents` existe
- Confirme as políticas de storage
- Verifique o limite de tamanho (20MB)

## 📄 Licença

Este projeto é privado e destinado uso interno de clínicas médicas.

## 🤝 Suporte

Para dúvidas ou suporte, entre em contato com a equipe de TI da clínica.
