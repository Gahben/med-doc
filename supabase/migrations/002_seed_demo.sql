-- ============================================================
-- MedDoc — Seed de demonstração v3
-- 
-- ANTES de rodar este script:
--   1. Vá em Authentication → Users → Add user
--   2. Crie os 3 usuários abaixo (marque "Auto Confirm User"):
--        admin@meddoc.local    / Admin@123
--        revisor@meddoc.local  / Revisor@123
--        operador@meddoc.local / Operador@123
--   3. Rode este script
-- ============================================================

-- Ajusta roles (o trigger cria todos como 'operador' por padrão)
update profiles set role = 'admin',    name = 'Admin Demo'
  where email = 'admin@meddoc.local';
update profiles set role = 'revisor',  name = 'Revisor Demo'
  where email = 'revisor@meddoc.local';
update profiles set role = 'operador', name = 'Operador Demo'
  where email = 'operador@meddoc.local';

-- Confirma que os roles foram aplicados
select name, email, role, active from profiles order by role;

-- Insere prontuários de demonstração usando o admin como autor
-- Cast explícito para record_status evita erro de tipo
insert into prontuarios (
  patient_name, patient_cpf, record_number,
  document_type, document_date, status, pages, uploaded_by
)
select
  names.name,
  lpad((row_number() over ())::text, 11, '0'),
  '2024-' || lpad((row_number() over ())::text, 5, '0'),
  types.tp,
  current_date - (random() * 365)::int,
  statuses.st::record_status,
  (random() * 10 + 1)::int,
  (select id from profiles where email = 'admin@meddoc.local' limit 1)
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
  (values ('approved'), ('pending'), ('reproved')) as statuses(st)
limit 25
on conflict (record_number) do nothing;

-- Resultado
select status::text, count(*) as quantidade
from prontuarios
group by status
order by status;
