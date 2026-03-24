-- ============================================================
-- MedDoc — Migração principal
-- Execute no SQL Editor do Supabase (https://app.supabase.com)
-- ============================================================

create extension if not exists "uuid-ossp";

create type user_role as enum ('admin', 'revisor', 'operador');
create type record_status as enum ('pending', 'approved', 'reproved', 'trash');
create type audit_action as enum ('upload', 'download', 'login', 'approved', 'reproved', 'print', 'delete', 'restore');

-- profiles
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  role       user_role not null default 'operador',
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- prontuarios
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
  uploaded_by     uuid references profiles(id),
  reviewed_by     uuid references profiles(id),
  reviewed_at     timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_prontuarios_cpf on prontuarios (patient_cpf);
create index if not exists idx_prontuarios_status on prontuarios (status);
create index if not exists idx_prontuarios_created_at on prontuarios (created_at desc);

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger prontuarios_updated_at
  before update on prontuarios
  for each row execute function update_updated_at();

-- audit_logs
create table if not exists audit_logs (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references profiles(id),
  action_type     audit_action not null,
  detail          text,
  prontuario_id   uuid references prontuarios(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_logs_created_at on audit_logs (created_at desc);
create index if not exists idx_logs_type on audit_logs (action_type);

-- RLS
alter table profiles enable row level security;
alter table prontuarios enable row level security;
alter table audit_logs enable row level security;

create or replace function is_admin()
returns boolean language sql security definer as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function current_user_role()
returns user_role language sql security definer as $$
  select role from profiles where id = auth.uid()
$$;

-- profiles policies
create policy "profiles_select" on profiles for select
  using (id = auth.uid() or is_admin());
create policy "profiles_update_admin" on profiles for update
  using (is_admin());
create policy "profiles_update_self" on profiles for update
  using (id = auth.uid());

-- prontuarios policies
create policy "prontuarios_select" on prontuarios for select
  using (auth.uid() is not null and (status != 'trash' or is_admin()));
create policy "prontuarios_insert" on prontuarios for insert
  with check (auth.uid() is not null and current_user_role() in ('admin', 'operador'));
create policy "prontuarios_update" on prontuarios for update
  using (auth.uid() is not null and current_user_role() in ('admin', 'revisor'));
create policy "prontuarios_delete" on prontuarios for delete
  using (is_admin());

-- logs policies
create policy "logs_insert" on audit_logs for insert
  with check (auth.uid() is not null);
create policy "logs_select" on audit_logs for select
  using (current_user_role() in ('admin', 'revisor'));

-- storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prontuarios', 'prontuarios', false, 20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "storage_insert" on storage.objects for insert
  with check (bucket_id = 'prontuarios' and auth.uid() is not null);
create policy "storage_select" on storage.objects for select
  using (bucket_id = 'prontuarios' and auth.uid() is not null);
create policy "storage_delete" on storage.objects for delete
  using (bucket_id = 'prontuarios' and is_admin());

-- dashboard view
create or replace view dashboard_stats as
select
  (select count(*) from prontuarios where status != 'trash') as total,
  (select count(*) from prontuarios where status = 'pending') as pending,
  (select count(*) from prontuarios where status = 'approved') as approved,
  (select count(*) from prontuarios where status = 'reproved') as reproved,
  (select count(*) from prontuarios where status = 'trash') as trash,
  (select count(*) from profiles where active = true) as active_users,
  (select count(*) from audit_logs where created_at > now() - interval '24h') as logs_24h;
