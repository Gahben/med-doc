-- ============================================================
-- MedDoc — Migração 009: Corrigir RLS de patient_requests
-- Execute no SQL Editor do Supabase
-- ============================================================
-- Substitui current_user_role() IN (...) por is_revisor() e
-- is_auditor() para evitar erros de cast implícito em transições
-- de status (especialmente no UPDATE com received_by).

DROP POLICY IF EXISTS "patient_requests_select" ON patient_requests;
DROP POLICY IF EXISTS "patient_requests_update" ON patient_requests;

-- Admins, revisores e auditores podem listar solicitações
CREATE POLICY "patient_requests_select" ON patient_requests FOR SELECT
  USING (
    is_admin()
    OR is_revisor()
    OR is_auditor()
  );

-- Admins, revisores e auditores podem atualizar
CREATE POLICY "patient_requests_update" ON patient_requests FOR UPDATE
  USING (
    is_admin()
    OR is_revisor()
    OR is_auditor()
  )
  WITH CHECK (
    is_admin()
    OR is_revisor()
    OR is_auditor()
  );

SELECT 'Migração 009 aplicada com sucesso!' AS status;
