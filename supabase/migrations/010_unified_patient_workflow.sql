-- ============================================================
-- MedDoc — Migração 010: Workflow unificado de solicitações
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Novos valores no enum de workflow dos prontuários
DO $$ BEGIN ALTER TYPE workflow_status ADD VALUE IF NOT EXISTS 'ready_for_delivery'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE workflow_status ADD VALUE IF NOT EXISTS 'cancelled'; EXCEPTION WHEN others THEN NULL; END $$;

-- Colunas de workflow unificado em patient_requests
ALTER TABLE patient_requests
  ADD COLUMN IF NOT EXISTS workflow_status text,
  ADD COLUMN IF NOT EXISTS prontuario_id uuid REFERENCES prontuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS record_number text;

-- Vínculo reverso no prontuário
ALTER TABLE prontuarios
  ADD COLUMN IF NOT EXISTS patient_request_id uuid REFERENCES patient_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patient_requests_workflow ON patient_requests (workflow_status);
CREATE INDEX IF NOT EXISTS idx_patient_requests_prontuario ON patient_requests (prontuario_id);
CREATE INDEX IF NOT EXISTS idx_prontuarios_patient_request ON prontuarios (patient_request_id);

-- Migrar status legado → workflow_status
UPDATE patient_requests SET workflow_status = CASE status
  WHEN 'pending'  THEN 'received'
  WHEN 'approved' THEN 'request_approved'
  WHEN 'rejected' THEN 'request_rejected'
  WHEN 'completed' THEN 'delivered'
  ELSE 'received'
END
WHERE workflow_status IS NULL;

ALTER TABLE patient_requests
  ALTER COLUMN workflow_status SET DEFAULT 'received';

UPDATE patient_requests SET workflow_status = 'received' WHERE workflow_status IS NULL;

ALTER TABLE patient_requests
  ALTER COLUMN workflow_status SET NOT NULL;

ALTER TABLE patient_requests DROP CONSTRAINT IF EXISTS patient_requests_workflow_status_check;
ALTER TABLE patient_requests ADD CONSTRAINT patient_requests_workflow_status_check
  CHECK (workflow_status IN (
    'received', 'request_approved', 'request_rejected',
    'in_production', 'not_found', 'in_audit',
    'correction_needed', 'corrected', 'concluded',
    'ready_for_delivery', 'delivered', 'cancelled'
  ));

-- Acompanhamento público por token (sem expor todas as solicitações)
CREATE OR REPLACE FUNCTION get_patient_request_by_token(p_token text)
RETURNS SETOF patient_requests
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM patient_requests
  WHERE upper(token) = upper(trim(p_token))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_patient_request_by_token(text) TO anon, authenticated;

-- Upload anônimo do PDF assinado (apenas signature_file_path)
CREATE OR REPLACE FUNCTION update_patient_request_signature(p_token text, p_file_path text)
RETURNS patient_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result patient_requests;
BEGIN
  UPDATE patient_requests
  SET signature_file_path = p_file_path,
      updated_at = now()
  WHERE upper(token) = upper(trim(p_token))
  RETURNING * INTO result;

  IF result.id IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION update_patient_request_signature(text, text) TO anon, authenticated;

SELECT 'Migração 010 aplicada com sucesso!' AS status;
