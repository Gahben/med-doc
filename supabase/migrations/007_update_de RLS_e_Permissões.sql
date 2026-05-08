-- =============================================
-- MIGRAÇÃO 007: Atualização de RLS + Permissões
-- =============================================

-- Funções auxiliares atualizadas
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

-- ====================== POLÍTICAS PARA PRONTUARIOS ======================

DROP POLICY IF EXISTS "prontuarios_select" ON prontuarios;
DROP POLICY IF EXISTS "prontuarios_insert" ON prontuarios;
DROP POLICY IF EXISTS "prontuarios_update" ON prontuarios;
DROP POLICY IF EXISTS "prontuarios_delete" ON prontuarios;

-- SELECT: Todos veem (exceto lixeira, só admin)
CREATE POLICY "prontuarios_select" ON prontuarios FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    status != 'trash' 
    OR is_admin()
  )
);

-- INSERT: Apenas Admin e Operador
CREATE POLICY "prontuarios_insert" ON prontuarios FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND current_user_role() IN ('admin', 'operador')
);

-- UPDATE: Permissões por role + workflow
CREATE POLICY "prontuarios_update" ON prontuarios FOR UPDATE
USING (
  auth.uid() IS NOT NULL AND (
    -- Admin: tudo
    is_admin()
    OR
    -- Revisor: só pode mudar received → approved/rejected
    (is_revisor() AND workflow_status IN ('received', 'request_approved', 'request_rejected'))
    OR
    -- Auditor: pode colocar em auditoria e pedir correção
    (is_auditor() AND workflow_status IN ('in_production', 'in_audit', 'correction_requested', 'corrected'))
    OR
    -- Operador: produção, correção, conclusão e entrega
    (current_user_role() = 'operador' AND workflow_status IN ('request_approved', 'in_production', 'not_found', 'corrected', 'completed', 'delivered'))
  )
);

-- DELETE: Apenas Admin
CREATE POLICY "prontuarios_delete" ON prontuarios FOR DELETE
USING (is_admin());

-- ====================== POLÍTICAS PARA VERSÕES ======================

ALTER TABLE prontuario_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "versions_select" ON prontuario_versions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM prontuarios p 
    WHERE p.id = prontuario_versions.prontuario_id 
    AND (p.status != 'trash' OR is_admin())
  )
);

CREATE POLICY "versions_insert" ON prontuario_versions FOR INSERT
WITH CHECK (
  current_user_role() IN ('admin', 'operador')
);

-- ====================== POLÍTICAS PARA SYSTEM_CONFIG ======================

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_config_select" ON system_config FOR SELECT
USING (true); -- Todos podem ler configurações

CREATE POLICY "system_config_update" ON system_config FOR UPDATE
USING (is_admin());

-- ====================== ATUALIZAÇÃO DA VIEW DE DASHBOARD ======================

CREATE OR REPLACE VIEW dashboard_stats WITH (security_invoker = true) AS
SELECT
  (SELECT count(*) FROM prontuarios WHERE status <> 'trash') AS total,
  (SELECT count(*) FROM prontuarios WHERE status = 'pending') AS pending,
  (SELECT count(*) FROM prontuarios WHERE status = 'approved') AS approved,
  (SELECT count(*) FROM prontuarios WHERE status = 'reproved') AS reproved,
  (SELECT count(*) FROM prontuarios WHERE status = 'trash') AS trash,
  
  (SELECT count(*) FROM profiles WHERE active = true) AS active_users,
  (SELECT count(*) FROM audit_logs WHERE created_at > now() - interval '24h') AS logs_24h,
  
  -- Workflow Stats
  (SELECT count(*) FROM prontuarios WHERE workflow_status = 'received') AS workflow_received,
  (SELECT count(*) FROM prontuarios WHERE workflow_status = 'request_approved') AS workflow_approved,
  (SELECT count(*) FROM prontuarios WHERE workflow_status = 'in_production') AS workflow_in_production,
  (SELECT count(*) FROM prontuarios WHERE workflow_status = 'in_audit') AS workflow_in_audit,
  (SELECT count(*) FROM prontuarios WHERE workflow_status = 'correction_requested') AS workflow_correction_requested,
  (SELECT count(*) FROM prontuarios WHERE workflow_status = 'completed') AS workflow_completed,
  (SELECT count(*) FROM prontuarios WHERE workflow_status = 'delivered') AS workflow_delivered,

  (SELECT count(*) FROM reviewer_notes WHERE resolved = false) AS pending_notes;