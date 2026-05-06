-- ============================================================
-- MedDoc — Seed de demonstração v4 (pós-refatoração de roles)
-- 
-- ANTES de rodar este script:
--   1. Execute a migração 004_roles_refactor.sql
--   2. Vá em Authentication → Users → Add user
--   3. Crie os usuários abaixo (marque "Auto Confirm User"):
--        admin@meddoc.local    / Admin@123
--        auditor@meddoc.local  / Auditor@123
--        revisor@meddoc.local  / Revisor@123
--        operador@meddoc.local / Operador@123
--   4. Rode este script
-- ============================================================

-- Roles dos usuários demo
-- (o trigger cria todos como 'operador' por padrão)
update profiles set role = 'admin',    name = 'Admin Demo'
  where email = 'admin@meddoc.local';
update profiles set role = 'auditor',  name = 'Auditor Demo'
  where email = 'auditor@meddoc.local';
update profiles set role = 'revisor',  name = 'Revisor Demo'
  where email = 'revisor@meddoc.local';
update profiles set role = 'operador', name = 'Operador Demo'
  where email = 'operador@meddoc.local';

-- Confirma roles
select name, email, role, active from profiles order by role;

-- Prontuários demo com workflow_status variado
insert into prontuarios (
  patient_name, patient_cpf, record_number,
  document_type, document_date, status, pages, uploaded_by, workflow_status
)
select
  names.name,
  lpad((row_number() over ())::text, 11, '0'),
  '2024-' || lpad((row_number() over ())::text, 5, '0'),
  types.tp,
  current_date - (random() * 365)::int,
  statuses.st::record_status,
  (random() * 10 + 1)::int,
  (select id from profiles where email = 'admin@meddoc.local' limit 1),
  wf.ws::workflow_status
from
  (values
    ('Ana Clara Ferreira'), ('Bruno Souza Lima'), ('Carla Mendes'),
    ('Diego Alves'), ('Elena Costa'), ('Fernando Rocha'),
    ('Gabriela Santos'), ('Henrique Oliveira'), ('Isabela Martins'),
    ('João Pedro Nunes'), ('Larissa Silva'), ('Marcos Vinicius')
  ) as names(name),
  (values
    ('Prontuário médico'), ('Exame laboratorial'), ('Laudo de imagem'),
    ('Receituário'), ('Atestado médico')
  ) as types(tp),
  (values ('approved'), ('pending'), ('reproved')) as statuses(st),
  (values 
    ('received'), ('request_approved'), ('in_production'), ('in_audit'), ('delivered'), (null)
  ) as wf(ws)
limit 25
on conflict (record_number) do nothing;

-- Resultado
select status::text, workflow_status::text, count(*) as quantidade
from prontuarios
group by status, workflow_status
order by status, workflow_status;
