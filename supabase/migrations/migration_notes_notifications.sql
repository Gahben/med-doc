-- =====================================================
-- MedDoc: Notas de Prontuário + Notificações
-- Rodar no SQL Editor do Supabase
-- =====================================================

-- 1. NOTAS DE PRONTUÁRIO
-- Histórico compartilhado de notas sobre um prontuário,
-- visível por todos os roles com acesso ao prontuário.
-- =====================================================
create table if not exists prontuario_notes (
  id            uuid primary key default gen_random_uuid(),
  prontuario_id uuid not null references prontuarios(id) on delete cascade,
  author_id     uuid not null references profiles(id) on delete cascade,
  body          text not null check (char_length(body) > 0),
  mentions      uuid[] default '{}',   -- ids dos usuários mencionados com @
  created_at    timestamptz default now()
);

create index if not exists prontuario_notes_prontuario_idx on prontuario_notes(prontuario_id, created_at desc);

-- RLS
alter table prontuario_notes enable row level security;

-- Qualquer usuário autenticado pode ler notas
create policy "notas_select" on prontuario_notes
  for select using (auth.role() = 'authenticated');

-- Qualquer usuário autenticado pode inserir (author_id = próprio id)
create policy "notas_insert" on prontuario_notes
  for insert with check (auth.uid() = author_id);

-- Somente o próprio autor pode deletar
create policy "notas_delete" on prontuario_notes
  for delete using (auth.uid() = author_id);


-- 2. NOTIFICAÇÕES
-- Geradas pelo app (não por trigger no banco) para manter
-- a lógica de negócio centralizada no frontend/storage.js
-- =====================================================
create table if not exists notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  prontuario_id uuid references prontuarios(id) on delete set null,
  type          text not null,   -- 'workflow_change' | 'mention' | 'note'
  message       text not null,
  read          boolean default false,
  created_at    timestamptz default now()
);

create index if not exists notifications_user_unread_idx on notifications(user_id, read, created_at desc);

-- RLS
alter table notifications enable row level security;

-- Usuário só vê as próprias notificações
create policy "notif_select" on notifications
  for select using (auth.uid() = user_id);

-- Qualquer autenticado pode criar notificação para outro usuário
-- (necessário para @menções e mudanças de status)
create policy "notif_insert" on notifications
  for insert with check (auth.role() = 'authenticated');

-- Usuário só marca as próprias como lidas
create policy "notif_update" on notifications
  for update using (auth.uid() = user_id);
