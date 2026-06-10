-- ============================================================
-- MedDoc — Migração 011: Estatísticas unificadas do workflow
-- Execute no SQL Editor do Supabase (após 010)
-- ============================================================

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

SELECT 'Migração 011 aplicada com sucesso!' AS status;
