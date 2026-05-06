-- ============================================================
-- MedDoc — Schema completo v3 (fresh install)
-- Execute no SQL Editor do Supabase → New query → Run
-- ============================================================

-- ── EXTENSÕES ────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── TIPOS ENUM ───────────────────────────────────────────────
do $$ begin create type user_role as enum ('admin', 'revisor', 'operador');
exception when duplicate_object then null; end $$;

do $$ begin create type record_status as enum ('pending', 'approved', 'reproved', 'trash');
exception when duplicate_object then null; end $$;

do $$ begin create type audit_action as enum (
  'upload', 'download', 'login', 'logout',
  'approved', 'reproved', 'print', 'delete', 'restore',
  'user_invited', 'user_role_changed', 'user_deactivated',
  'user_activated', 'user_deleted', 'password_reset_sent'
);
exception when duplicate_object then null; end $$;

-- ── PROFILES ─────────────────────────────────────────────────
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null default 'Usuário',
  email      text,                              -- cache do email para exibição no admin
  role       user_role not null default 'operador',
  active     boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role   on profiles (role);
create index if not exists idx_profiles_active on profiles (active);

-- Trigger: atualiza updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

-- Trigger: cria perfil automaticamente ao criar usuário Auth
-- Suporta login por e-mail E Google OAuth (que usa 'full_name')
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name, email, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',   -- Google OAuth
      split_part(new.email, '@', 1),
      'Usuário'
    ),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'operador')
  )
  on conflict (id) do update set
    email = excluded.email,
    -- Atualiza avatar se vier do Google
    avatar_url = coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture',
      profiles.avatar_url
    ),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── PRONTUARIOS ───────────────────────────────────────────────
create table if not exists prontuarios (
  id              uuid primary key default uuid_generate_v4(),
  patient_name    text not null,
  patient_cpf     text not null,
  record_number   text not null unique,
  document_type   text not null default 'Prontuário médico',
  document_date   date,
  file_path       text,
  file_name       text,
  file_size       bigint,
  pages           int not null default 1,
  status          record_status not null default 'pending',
  locked          boolean not null default false,
  upload_note     text,
  review_note     text,
  uploaded_by     uuid references profiles(id) on delete set null,
  reviewed_by     uuid references profiles(id) on delete set null,
  reviewed_at     timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_prontuarios_cpf        on prontuarios (patient_cpf);
create index if not exists idx_prontuarios_status     on prontuarios (status);
create index if not exists idx_prontuarios_created_at on prontuarios (created_at desc);
create index if not exists idx_prontuarios_uploaded   on prontuarios (uploaded_by);

drop trigger if exists prontuarios_updated_at on prontuarios;
create trigger prontuarios_updated_at
  before update on prontuarios
  for each row execute function update_updated_at();

-- ── AUDIT LOGS ────────────────────────────────────────────────
create table if not exists audit_logs (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references profiles(id) on delete set null,
  action_type     audit_action not null,
  detail          text,
  prontuario_id   uuid references prontuarios(id) on delete set null,
  target_user_id  uuid references profiles(id) on delete set null,  -- para ações admin sobre usuários
  ip_address      text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_logs_created_at    on audit_logs (created_at desc);
create index if not exists idx_logs_type          on audit_logs (action_type);
create index if not exists idx_logs_user          on audit_logs (user_id);
create index if not exists idx_logs_target_user   on audit_logs (target_user_id);

-- ── FUNÇÕES DE SEGURANÇA ──────────────────────────────────────
create or replace function is_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and active = true
  );
$$;

create or replace function current_user_role()
returns user_role language sql security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active = true;
$$;

-- Verifica se usuário está ativo (bloqueia login de inativos via RLS)
create or replace function is_active_user()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and active = true
  );
$$;

-- ── RLS ───────────────────────────────────────────────────────
alter table profiles    enable row level security;
alter table prontuarios enable row level security;
alter table audit_logs  enable row level security;

-- PROFILES
drop policy if exists "profiles_select"       on profiles;
drop policy if exists "profiles_update_admin" on profiles;
drop policy if exists "profiles_update_self"  on profiles;

create policy "profiles_select" on profiles for select
  using (id = auth.uid() or is_admin());

create policy "profiles_update_admin" on profiles for update
  using (is_admin());

create policy "profiles_update_self" on profiles for update
  using (id = auth.uid());

-- PRONTUARIOS
drop policy if exists "prontuarios_select"       on prontuarios;
drop policy if exists "prontuarios_select_teste" on prontuarios;
drop policy if exists "prontuarios_insert"       on prontuarios;
drop policy if exists "prontuarios_update"       on prontuarios;
drop policy if exists "prontuarios_delete"       on prontuarios;

-- Admin e revisor veem tudo; operador vê apenas os próprios (exceto trash)
create policy "prontuarios_select" on prontuarios for select
  using (
    is_active_user() and (
      is_admin()
      or current_user_role() = 'revisor'
      or (uploaded_by = auth.uid() and status <> 'trash')
    )
  );

create policy "prontuarios_insert" on prontuarios for insert
  with check (
    is_active_user()
    and current_user_role() in ('admin', 'operador')
  );

create policy "prontuarios_update" on prontuarios for update
  using (
    is_active_user()
    and current_user_role() in ('admin', 'revisor')
  );

create policy "prontuarios_delete" on prontuarios for delete
  using (is_admin());

-- AUDIT LOGS
drop policy if exists "logs_insert" on audit_logs;
drop policy if exists "logs_select" on audit_logs;

create policy "logs_insert" on audit_logs for insert
  with check (is_active_user());

create policy "logs_select" on audit_logs for select
  using (current_user_role() in ('admin', 'revisor'));

-- ── STORAGE BUCKET ────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'prontuarios', 'prontuarios', false, 20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "storage_insert" on storage.objects;
drop policy if exists "storage_select" on storage.objects;
drop policy if exists "storage_delete" on storage.objects;

create policy "storage_insert" on storage.objects for insert
  with check (bucket_id = 'prontuarios' and is_active_user());

create policy "storage_select" on storage.objects for select
  using (bucket_id = 'prontuarios' and is_active_user());

create policy "storage_delete" on storage.objects for delete
  using (bucket_id = 'prontuarios' and is_admin());

-- ── DASHBOARD VIEW (sem RLS — acesso via service role na Edge Function ou lido pelo admin) ──
create or replace view dashboard_stats with (security_invoker = true) as
select
  (select count(*) from prontuarios where status <> 'trash') as total,
  (select count(*) from prontuarios where status = 'pending')  as pending,
  (select count(*) from prontuarios where status = 'approved') as approved,
  (select count(*) from prontuarios where status = 'reproved') as reproved,
  (select count(*) from prontuarios where status = 'trash')    as trash,
  (select count(*) from profiles    where active = true)       as active_users,
  (select count(*) from audit_logs  where created_at > now() - interval '24h') as logs_24h;
