-- ============================================================
-- MedDoc — Migração 014: Adiciona campo para notas do prontuário em ai_triage_results
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Adiciona campo para armazenar as notas do prontuário extraídas pelo Gemini
ALTER TABLE ai_triage_results ADD COLUMN IF NOT EXISTS prontuario_notes text;

-- Adiciona comentário explicativo
COMMENT ON COLUMN ai_triage_results.prontuario_notes IS 'Notas do prontuário extraídas pelo Gemini durante a triagem da solicitação';

SELECT 'Migração 014 aplicada com sucesso!' AS status;
