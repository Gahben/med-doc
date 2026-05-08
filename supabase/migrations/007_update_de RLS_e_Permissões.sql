-- =============================================
-- MIGRAÇÃO 007: Atualização de RLS + Permissões
-- (VERSÃO SEGURA - verifica existência)
-- =============================================

-- Adiciona valores ao enum workflow_status (se o enum existir)
DO $$ 
BEGIN
  BEGIN ALTER TYPE workflow_status ADD VALUE IF NOT EXISTS 'received'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE workflow_status ADD VALUE IF NOT EXISTS 'request_approved'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE workflow_status ADD VALUE IF NOT EXISTS 'request_rejected'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE workflow_status ADD VALUE IF NOT EXISTS 'in_production'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE workflow_status ADD VALUE IF NOT EXISTS 'not_found'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE workflow_status ADD VALUE IF NOT EXISTS 'in_audit'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE workflow_status ADD VALUE IF NOT EXISTS 'correction_needed'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE workflow_status ADD VALUE IF NOT EXISTS 'corrected'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE workflow_status ADD VALUE IF NOT EXISTS 'concluded'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE workflow_status ADD VALUE IF NOT EXISTS 'delivered'; EXCEPTION WHEN others THEN NULL; END;
END $$;

-- ====================== FUNÇÕES AUXILIARES ======================

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role LANGUAGE sql SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid() AND active = true;
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin' AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION is_auditor()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'auditor' AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION is_revisor()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'revisor' AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION is_operador()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'operador' AND active = true
  );
$$;

-- ====================== POLÍTICAS PARA PRONTUARIOS ======================

DROP POLICY IF EXISTS "prontuarios_select" ON prontuarios;
DROP POLICY IF EXISTS "prontuarios_insert" ON prontuarios;
DROP POLICY IF EXISTS "prontuarios_update" ON prontuarios;
DROP POLICY IF EXISTS "prontuarios_delete" ON prontuarios;

CREATE POLICY "prontuarios_select" ON prontuarios FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (status <> 'trash'::record_status OR is_admin())
);

CREATE POLICY "prontuarios_insert" ON prontuarios FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND current_user_role() IN ('admin', 'operador')
);

CREATE POLICY "prontuarios_update" ON prontuarios FOR UPDATE
USING (
  auth.uid() IS NOT NULL AND (
    is_admin()
    OR is_revisor()
    OR is_auditor()
    OR is_operador()
  )
);

CREATE POLICY "prontuarios_delete" ON prontuarios FOR DELETE
USING (is_admin());

-- ====================== POLÍTICAS PARA REVIEWER_NOTES ======================

ALTER TABLE IF EXISTS reviewer_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notes_select" ON reviewer_notes;
DROP POLICY IF EXISTS "notes_insert" ON reviewer_notes;
DROP POLICY IF EXISTS "notes_update" ON reviewer_notes;

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reviewer_notes') THEN
    CREATE POLICY "notes_select" ON reviewer_notes FOR SELECT
    USING (
      is_admin() OR is_revisor() OR is_auditor()
      OR EXISTS (
        SELECT 1 FROM prontuarios p 
        WHERE p.id = reviewer_notes.prontuario_id AND p.uploaded_by = auth.uid()
      )
    );

    CREATE POLICY "notes_insert" ON reviewer_notes FOR INSERT
    WITH CHECK (current_user_role() IN ('admin', 'revisor'));

    CREATE POLICY "notes_update" ON reviewer_notes FOR UPDATE
    USING (author_id = auth.uid() OR is_admin());
  END IF;
END $$;

-- ====================== POLÍTICAS PARA SYSTEM_CONFIG ======================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'system_config') THEN
    ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "system_config_select" ON system_config;
    DROP POLICY IF EXISTS "system_config_update" ON system_config;
    DROP POLICY IF EXISTS "system_config_insert" ON system_config;

    CREATE POLICY "system_config_select" ON system_config FOR SELECT USING (true);
    CREATE POLICY "system_config_update" ON system_config FOR UPDATE USING (is_admin());
    CREATE POLICY "system_config_insert" ON system_config FOR INSERT WITH CHECK (is_admin());
  END IF;
END $$;

-- ====================== ATUALIZAÇÃO DA VIEW DE DASHBOARD ======================

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
  (SELECT count(*) FROM prontuarios WHERE workflow_status::text = 'received') AS workflow_received,
  (SELECT count(*) FROM prontuarios WHERE workflow_status::text = 'request_approved') AS workflow_approved,
  (SELECT count(*) FROM prontuarios WHERE workflow_status::text = 'request_rejected') AS workflow_rejected,
  (SELECT count(*) FROM prontuarios WHERE workflow_status::text = 'in_production') AS workflow_in_production,
  (SELECT count(*) FROM prontuarios WHERE workflow_status::text = 'not_found') AS workflow_not_found,
  (SELECT count(*) FROM prontuarios WHERE workflow_status::text = 'in_audit') AS workflow_in_audit,
  (SELECT count(*) FROM prontuarios WHERE workflow_status::text = 'correction_needed') AS workflow_correction_needed,
  (SELECT count(*) FROM prontuarios WHERE workflow_status::text = 'corrected') AS workflow_corrected,
  (SELECT count(*) FROM prontuarios WHERE workflow_status::text = 'concluded') AS workflow_concluded,
  (SELECT count(*) FROM prontuarios WHERE workflow_status::text = 'delivered') AS workflow_delivered,
  (SELECT count(*) FROM reviewer_notes WHERE resolved = false) AS pending_reviewer_notes;