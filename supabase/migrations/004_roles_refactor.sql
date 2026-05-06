-- ============================================================
-- MedDoc — Migração 004: Refatoração de Roles
-- 
-- Alterações:
--   • Renomeia 'revisor' → 'auditor'
--   • Adiciona novo role 'revisor' (valida solicitações externas)
--   • Atualiza RLS para novo modelo de permissões
--   • Cria tabela solicitation_notes para notas do revisor ao operador
--   • Cria coluna workflow_status para rastrear etapas do fluxo externo
-- ============================================================

-- 1. Adicionar novos valores ao enum (não é possível renomear direto)
--    Estratégia: criar novo enum, migrar, dropar antigo

-- Cria novo enum com todos os roles
create type user_role_new as enum ('admin', 'auditor', 'revisor', 'operador');

-- Migra a coluna profiles.role
alter table profiles 
  alter column role type user_role_new 
  using (
    case role::text
      when 'revisor'  then 'auditor'::user_role_new
      when 'admin'    then 'admin'::user_role_new
      when 'operador' then 'operador'::user_role_new
      else 'operador'::user_role_new
    end
  );

-- Seta novo default
alter table profiles alter column role set default 'operador'::user_role_new;

-- Dropa enum antigo e renomeia novo
drop type user_role;
alter type user_role_new rename to user_role;

-- 2. Atualiza trigger handle_new_user para novo enum
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'operador')
  );
  return new;
end;
$$;

-- 3. Atualiza funções helper
create or replace function is_admin()
returns boolean language sql security definer as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function current_user_role()
returns user_role language sql security definer as $$
  select role from profiles where id = auth.uid()
$$;

-- 4. Cria tabela de workflow_status para prontuários
--    Permite rastrear o fluxo externo de solicitação
do $$ begin
  if not exists (select 1 from pg_type where typname = 'workflow_status') then
    create type workflow_status as enum (
      'received',          -- solicitação recebida pelo sistema externo
      'request_approved',  -- revisor aprovou a solicitação
      'request_rejected',  -- revisor rejeitou a solicitação
      'in_production',     -- operador está produzindo
      'in_audit',          -- auditor está revisando o documento
      'delivered'          -- operador fez o envio/entrega
    );
  end if;
end $$;

-- Adiciona coluna workflow_status à tabela prontuarios (nullable, para compatibilidade)
alter table prontuarios 
  add column if not exists workflow_status workflow_status default null;

-- 5. Tabela de notas do revisor para o operador (comunicação interna)
create table if not exists reviewer_notes (
  id              uuid primary key default uuid_generate_v4(),
  prontuario_id   uuid not null references prontuarios(id) on delete cascade,
  author_id       uuid not null references profiles(id),
  note_text       text not null,
  note_type       text not null default 'info', -- 'info' | 'needs_contact' | 'correction_required'
  resolved        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_reviewer_notes_prontuario on reviewer_notes(prontuario_id);
create index if not exists idx_reviewer_notes_resolved on reviewer_notes(resolved) where not resolved;

create trigger reviewer_notes_updated_at
  before update on reviewer_notes
  for each row execute function update_updated_at();

-- RLS para reviewer_notes
alter table reviewer_notes enable row level security;

create policy "reviewer_notes_select" on reviewer_notes for select
  using (
    auth.uid() is not null 
    and current_user_role() in ('admin', 'auditor', 'revisor', 'operador')
  );

create policy "reviewer_notes_insert" on reviewer_notes for insert
  with check (
    auth.uid() is not null 
    and current_user_role() in ('admin', 'revisor')
  );

create policy "reviewer_notes_update" on reviewer_notes for update
  using (
    auth.uid() is not null 
    and (author_id = auth.uid() or is_admin())
  );

-- 6. Recria políticas de prontuarios com novo modelo de roles
-- (drop antigas e recria)
drop policy if exists "prontuarios_insert" on prontuarios;
drop policy if exists "prontuarios_update" on prontuarios;
drop policy if exists "prontuarios_select" on prontuarios;
drop policy if exists "prontuarios_delete" on prontuarios;

-- Todos autenticados veem prontuários (exceto lixeira, que só admin vê)
create policy "prontuarios_select" on prontuarios for select
  using (auth.uid() is not null and (status != 'trash' or is_admin()));

-- Insert: admin, operador — (revisor não cria prontuários)
create policy "prontuarios_insert" on prontuarios for insert
  with check (auth.uid() is not null and current_user_role() in ('admin', 'operador'));

-- Update: admin, auditor (muda status do documento), operador (atualiza workflow_status)
-- O revisor atualiza via workflow_status (solicitação)
create policy "prontuarios_update" on prontuarios for update
  using (
    auth.uid() is not null 
    and current_user_role() in ('admin', 'auditor', 'revisor', 'operador')
  );

-- Delete: apenas admin
create policy "prontuarios_delete" on prontuarios for delete
  using (is_admin());

-- 7. Recria políticas de logs com novo modelo
drop policy if exists "logs_select" on audit_logs;

create policy "logs_select" on audit_logs for select
  using (current_user_role() in ('admin', 'auditor'));

-- 8. Adiciona 'revisao' e 'auditoria' ao enum de audit_action se ainda não existir
-- (adiciona novos valores de forma segura)
do $$ begin
  begin
    alter type audit_action add value if not exists 'revisao';
  exception when others then null;
  end;
  begin
    alter type audit_action add value if not exists 'auditoria';
  exception when others then null;
  end;
  begin
    alter type audit_action add value if not exists 'workflow_update';
  exception when others then null;
  end;
end $$;

-- 9. Atualiza dashboard_stats view para incluir workflow
create or replace view dashboard_stats as
select
  (select count(*) from prontuarios where status != 'trash') as total,
  (select count(*) from prontuarios where status = 'pending') as pending,
  (select count(*) from prontuarios where status = 'approved') as approved,
  (select count(*) from prontuarios where status = 'reproved') as reproved,
  (select count(*) from prontuarios where status = 'trash') as trash,
  (select count(*) from profiles where active = true) as active_users,
  (select count(*) from audit_logs where created_at > now() - interval '24h') as logs_24h,
  -- Workflow stats (para sistema externo futuro)
  (select count(*) from prontuarios where workflow_status = 'received') as workflow_received,
  (select count(*) from prontuarios where workflow_status = 'in_production') as workflow_in_production,
  (select count(*) from prontuarios where workflow_status = 'in_audit') as workflow_in_audit,
  (select count(*) from prontuarios where workflow_status = 'delivered') as workflow_delivered,
  (select count(*) from reviewer_notes where resolved = false) as pending_reviewer_notes;

-- 10. Seed demo: adiciona usuários auditor e revisor
-- (instruções: criar no Supabase Auth antes de rodar)
-- update profiles set role = 'auditor', name = 'Auditor Demo' where email = 'auditor@meddoc.local';
-- update profiles set role = 'revisor', name = 'Revisor Demo' where email = 'revisor@meddoc.local';

comment on column prontuarios.workflow_status is 
  'Status do fluxo de solicitação externa. Controlado via edge function do sistema externo.';
comment on table reviewer_notes is 
  'Notas do revisor para o operador. Usadas para comunicação sobre pendências de solicitação.';
