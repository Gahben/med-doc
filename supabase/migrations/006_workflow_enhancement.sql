-- =============================================
-- MIGRAÇÃO 006: Workflow Completo + Melhorias
-- =============================================

-- 1. Enum workflow_status mais completo
DO $$ BEGIN
  CREATE TYPE workflow_status AS ENUM (
    'received',              -- Revisor recebeu solicitação
    'request_approved',      -- Revisor aprovou
    'request_rejected',      -- Revisor rejeitou
    'in_production',         -- Operador está produzindo
    'not_found',             -- Operador: Prontuário não encontrado
    'in_audit',              -- Auditor está revisando
    'correction_requested',  -- Auditor pediu correção
    'corrected',             -- Corrigido (pelo operador ou auditor)
    'completed',             -- Prontuário finalizado
    'delivered'              -- Entregue ao solicitante
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Novas colunas na tabela prontuarios
ALTER TABLE prontuarios 
  ADD COLUMN IF NOT EXISTS origin_sector       text,
  ADD COLUMN IF NOT EXISTS document_type       text NOT NULL DEFAULT 'Prontuário médico',
  ADD COLUMN IF NOT EXISTS version             int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS never_delete        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS file_hash           text,
  ADD COLUMN IF NOT EXISTS lifecycle_days      int DEFAULT 90,
  ADD COLUMN IF NOT EXISTS last_downloaded_at  timestamptz,
  ADD COLUMN IF NOT EXISTS printed_at          timestamptz;

-- 3. Tabela de histórico de versões
CREATE TABLE IF NOT EXISTS prontuario_versions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prontuario_id   uuid REFERENCES prontuarios(id) ON DELETE CASCADE,
  version         int NOT NULL,
  file_path       text NOT NULL,
  file_name       text NOT NULL,
  file_size       bigint,
  file_hash       text,
  uploaded_by     uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now()
);

-- 4. Tabela de configuração do sistema
CREATE TABLE IF NOT EXISTS system_config (
  id                        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  auto_trash_days           int DEFAULT 90,
  enable_email_notifications boolean DEFAULT true,
  allowed_sectors           text[] DEFAULT '{}',
  document_types            text[] DEFAULT '{}',
  updated_at                timestamptz DEFAULT now()
);

-- Insere configuração inicial
INSERT INTO system_config (id) VALUES (uuid_generate_v4())
ON CONFLICT DO NOTHING;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_prontuarios_file_hash ON prontuarios(file_hash);
CREATE INDEX IF NOT EXISTS idx_prontuarios_origin_sector ON prontuarios(origin_sector);
CREATE INDEX IF NOT EXISTS idx_prontuarios_workflow ON prontuarios(workflow_status);