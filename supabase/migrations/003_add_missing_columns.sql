-- ============================================================
-- MedDoc — Migração 003: colunas e tabelas adicionais
-- Execute no SQL Editor do Supabase APÓS o 001_schema.sql
-- ============================================================

-- ── 1. Adiciona colunas que páginas do frontend esperam ──────

-- workflow_status: controlado pelo revisor (painel de solicitações)
ALTER TABLE prontuarios
  ADD COLUMN IF NOT EXISTS workflow_status text
  CHECK (workflow_status IN (
    'received','request_approved','request_rejected',
    'in_production','in_audit','delivered'
  ));

-- resubmit_note: nota do operador ao reenviar prontuário corrigido
ALTER TABLE prontuarios
  ADD COLUMN IF NOT EXISTS resubmit_note text;

-- ── 2. Corrige enum audit_action para incluir todos os valores
--       usados pelo frontend (safe: adiciona valores sem remover)

DO $$ BEGIN
  ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'logout';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'resubmit';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow_update';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'reviewer_note';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'user_invited';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'user_role_changed';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'user_deactivated';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'user_activated';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'user_deleted';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'password_reset_sent';
EXCEPTION WHEN others THEN NULL; END $$;

-- ── 3. Corrige enum user_role para incluir 'auditor' ─────────

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'auditor';
EXCEPTION WHEN others THEN NULL; END $$;

-- ── 4. Tabela reviewer_notes (notas do revisor para operador) ─

CREATE TABLE IF NOT EXISTS reviewer_notes (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prontuario_id  uuid REFERENCES prontuarios(id) ON DELETE CASCADE,
  author_id      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  note_text      text NOT NULL,
  note_type      text NOT NULL DEFAULT 'info'
    CHECK (note_type IN ('needs_contact', 'correction_required', 'info')),
  resolved       boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviewer_notes_prontuario ON reviewer_notes (prontuario_id);
CREATE INDEX IF NOT EXISTS idx_reviewer_notes_resolved   ON reviewer_notes (resolved);

-- RLS para reviewer_notes
ALTER TABLE reviewer_notes ENABLE ROW LEVEL SECURITY;

-- Trigger para preencher author_id automaticamente
CREATE OR REPLACE FUNCTION set_reviewer_note_author()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.author_id = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviewer_notes_author ON reviewer_notes;
CREATE TRIGGER reviewer_notes_author
  BEFORE INSERT ON reviewer_notes
  FOR EACH ROW EXECUTE FUNCTION set_reviewer_note_author();

DROP POLICY IF EXISTS "notes_select" ON reviewer_notes;
DROP POLICY IF EXISTS "notes_insert" ON reviewer_notes;
DROP POLICY IF EXISTS "notes_update" ON reviewer_notes;

-- Revisores e admins veem todas as notas; operadores veem notas dos seus prontuários
CREATE POLICY "notes_select" ON reviewer_notes FOR SELECT
  USING (
    is_active_user() AND (
      is_admin()
      OR current_user_role() = 'revisor'
      OR EXISTS (
        SELECT 1 FROM prontuarios p
        WHERE p.id = prontuario_id AND p.uploaded_by = auth.uid()
      )
    )
  );

CREATE POLICY "notes_insert" ON reviewer_notes FOR INSERT
  WITH CHECK (
    is_active_user()
    AND current_user_role() IN ('admin', 'revisor')
  );

-- Só o autor pode marcar como resolvida
CREATE POLICY "notes_update" ON reviewer_notes FOR UPDATE
  USING (
    is_active_user()
    AND (author_id = auth.uid() OR is_admin())
  );

-- ── 5. Adiciona target_user_id em audit_logs (para ações admin) ─

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- ── 6. Adiciona campo email e avatar_url em profiles ──────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email      text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Popula email dos perfis existentes a partir de auth.users
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- ── 7. Atualiza dashboard_stats para incluir workflow e notas ─

CREATE OR REPLACE VIEW dashboard_stats WITH (security_invoker = true) AS
SELECT
  (SELECT count(*) FROM prontuarios WHERE status <> 'trash')               AS total,
  (SELECT count(*) FROM prontuarios WHERE status = 'pending')              AS pending,
  (SELECT count(*) FROM prontuarios WHERE status = 'approved')             AS approved,
  (SELECT count(*) FROM prontuarios WHERE status = 'reproved')             AS reproved,
  (SELECT count(*) FROM prontuarios WHERE status = 'trash')                AS trash,
  (SELECT count(*) FROM profiles    WHERE active = true)                   AS active_users,
  (SELECT count(*) FROM audit_logs  WHERE created_at > now() - interval '24h') AS logs_24h,
  -- workflow
  (SELECT count(*) FROM prontuarios WHERE workflow_status = 'received')       AS workflow_received,
  (SELECT count(*) FROM prontuarios WHERE workflow_status = 'in_production')   AS workflow_in_production,
  (SELECT count(*) FROM prontuarios WHERE workflow_status = 'in_audit')        AS workflow_in_audit,
  (SELECT count(*) FROM prontuarios WHERE workflow_status = 'delivered')       AS workflow_delivered,
  -- notas pendentes
  (SELECT count(*) FROM reviewer_notes WHERE resolved = false)               AS pending_reviewer_notes;

-- ── 8. Atualiza handle_new_user para suportar campo email ─────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, name, email, role, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      SPLIT_PART(NEW.email, '@', 1),
      'Usuário'
    ),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'operador'),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = now();
  RETURN NEW;
END;
$$;

-- Confirmação
SELECT 'Migração 003 aplicada com sucesso!' AS status;
