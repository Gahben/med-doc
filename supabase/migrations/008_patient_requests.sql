-- ============================================================
-- MedDoc — Migração 008: Tabela de solicitações de pacientes
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ── Tabela patient_requests (solicitações de pacientes) ──

CREATE TABLE IF NOT EXISTS patient_requests (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  token           text NOT NULL UNIQUE,  -- Token para acompanhamento
  requester_name  text NOT NULL,
  requester_cpf   text NOT NULL,
  request_reason  text NOT NULL,
  hospital_period text NOT NULL,  -- Data/período que estava no hospital
  insurance       text,             -- Convênio
  contact_phone   text NOT NULL,
  
  -- Solicitação por terceiros
  is_third_party  boolean NOT NULL DEFAULT false,
  third_party_name text,
  third_party_cpf  text,
  third_party_relationship text,
  
  -- Status da solicitação
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  
  -- Assinatura
  signature_method text NOT NULL DEFAULT 'manual'
    CHECK (signature_method IN ('manual', 'gov_br')),
  signature_file_path text,  -- Caminho do PDF assinado
  
  -- Informações de recebimento
  received_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  received_at     timestamptz,
  
  -- Notas
  notes           text,
  
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_requests_token ON patient_requests (token);
CREATE INDEX IF NOT EXISTS idx_patient_requests_cpf ON patient_requests (requester_cpf);
CREATE INDEX IF NOT EXISTS idx_patient_requests_status ON patient_requests (status);
CREATE INDEX IF NOT EXISTS idx_patient_requests_created ON patient_requests (created_at DESC);

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS patient_requests_updated_at ON patient_requests;
CREATE TRIGGER patient_requests_updated_at
  BEFORE UPDATE ON patient_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS para patient_requests ──

ALTER TABLE patient_requests ENABLE ROW LEVEL SECURITY;

-- Políticas: público pode inserir (sem auth), admins podem tudo
DROP POLICY IF EXISTS "patient_requests_insert" ON patient_requests;
DROP POLICY IF EXISTS "patient_requests_select" ON patient_requests;
DROP POLICY IF EXISTS "patient_requests_update" ON patient_requests;

-- Público pode inserir (sem autenticação)
CREATE POLICY "patient_requests_insert" ON patient_requests FOR INSERT
  WITH CHECK (true);

-- Admins e revisores podem ver tudo
CREATE POLICY "patient_requests_select" ON patient_requests FOR SELECT
  USING (
    is_admin()
    OR current_user_role() IN ('admin', 'revisor', 'auditor')
  );

-- Admins e revisores podem atualizar
CREATE POLICY "patient_requests_update" ON patient_requests FOR UPDATE
  USING (
    is_admin()
    OR current_user_role() IN ('admin', 'revisor', 'auditor')
  );

-- Confirmação
SELECT 'Migração 008 aplicada com sucesso!' AS status;
