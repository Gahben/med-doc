-- ============================================================
-- MedDoc — Migração 012: Tabelas para Features de IA
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Resultados da triagem automática (Feature 1)
CREATE TABLE IF NOT EXISTS ai_triage_results (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_request_id uuid REFERENCES patient_requests(id) ON DELETE CASCADE,
  urgency_level   text NOT NULL CHECK (urgency_level IN ('low','medium','high','critical')),
  urgency_reason  text,
  inconsistencies jsonb DEFAULT '[]',
  summary         text NOT NULL,
  model_used      text DEFAULT 'gemini',
  raw_response    jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_triage_req_id ON ai_triage_results (patient_request_id);

-- 2. Resumos gerados para o Admin (Feature 4)
CREATE TABLE IF NOT EXISTS ai_admin_summaries (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  summary_text    text NOT NULL,
  period_start    timestamptz,
  period_end      timestamptz,
  metrics         jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 3. Alertas de anomalia detectados (Feature 5)
CREATE TABLE IF NOT EXISTS ai_anomaly_alerts (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  anomaly_type    text NOT NULL,
  description     text NOT NULL,
  prontuario_id   uuid REFERENCES prontuarios(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES profiles(id) ON DELETE CASCADE,
  severity        text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  dismissed       boolean NOT NULL DEFAULT false,
  raw_data        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_anomaly_dismissed ON ai_anomaly_alerts (dismissed);

-- 4. Atualizar view dashboard_stats para não quebrar
-- (Não precisamos expor as tabelas de IA na view agora, mas é bom recriá-la se necessário)
DROP VIEW IF EXISTS dashboard_stats;

CREATE OR REPLACE VIEW dashboard_stats WITH (security_invoker = true) AS
SELECT
  (SELECT count(*) FROM prontuarios WHERE status <> 'trash'::record_status) AS total,
  (SELECT count(*) FROM prontuarios WHERE status = 'pending') AS pending,
  (SELECT count(*) FROM prontuarios WHERE status = 'approved') AS approved,
  (SELECT count(*) FROM prontuarios WHERE status = 'reproved') AS reproved,
  (SELECT count(*) FROM prontuarios WHERE status = 'trash'::record_status) AS trash,
  (SELECT count(*) FROM profiles WHERE active = true) AS active_users,
  (SELECT count(*) FROM audit_logs WHERE created_at > now() - interval '24h') AS logs_24h,
  (SELECT count(*) FROM patient_requests) AS patient_requests_total,
  (SELECT count(*) FROM patient_requests WHERE workflow_status = 'received') AS workflow_received,
  (SELECT count(*) FROM patient_requests WHERE workflow_status = 'request_approved') AS workflow_approved,
  (SELECT count(*) FROM patient_requests WHERE workflow_status = 'request_rejected') AS workflow_rejected,
  (SELECT count(*) FROM patient_requests WHERE workflow_status = 'in_production') AS workflow_in_production,
  (SELECT count(*) FROM patient_requests WHERE workflow_status = 'not_found') AS workflow_not_found,
  (SELECT count(*) FROM patient_requests WHERE workflow_status = 'in_audit') AS workflow_in_audit,
  (SELECT count(*) FROM patient_requests WHERE workflow_status = 'correction_needed') AS workflow_correction_needed,
  (SELECT count(*) FROM patient_requests WHERE workflow_status = 'corrected') AS workflow_corrected,
  (SELECT count(*) FROM patient_requests WHERE workflow_status = 'concluded') AS workflow_concluded,
  (SELECT count(*) FROM patient_requests WHERE workflow_status = 'ready_for_delivery') AS workflow_ready_for_delivery,
  (SELECT count(*) FROM patient_requests WHERE workflow_status = 'delivered') AS workflow_delivered,
  (SELECT count(*) FROM patient_requests WHERE workflow_status = 'cancelled') AS workflow_cancelled,
  (SELECT count(*) FROM reviewer_notes WHERE resolved = false) AS pending_reviewer_notes;

-- 5. RLS para as novas tabelas (acesso apenas para usuários autenticados)
ALTER TABLE ai_triage_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_admin_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_anomaly_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_triage_select" ON ai_triage_results FOR SELECT USING (is_active_user());
CREATE POLICY "ai_admin_summaries_select" ON ai_admin_summaries FOR SELECT USING (is_active_user() AND (is_admin() OR current_user_role() = 'auditor'));
CREATE POLICY "ai_anomaly_alerts_select" ON ai_anomaly_alerts FOR SELECT USING (is_active_user() AND (is_admin() OR current_user_role() = 'auditor'));
CREATE POLICY "ai_anomaly_alerts_update" ON ai_anomaly_alerts FOR UPDATE USING (is_active_user() AND (is_admin() OR current_user_role() = 'auditor'));

SELECT 'Migração 012 aplicada com sucesso!' AS status;
