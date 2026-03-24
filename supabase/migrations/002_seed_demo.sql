-- ============================================================
-- 002_seed_demo.sql — Dados de demonstração (OPCIONAL)
-- Execute APENAS em ambiente de desenvolvimento/teste.
-- NÃO execute em produção.
-- ============================================================

-- Para criar usuários de demo:
-- 1. Crie manualmente pelo painel do Supabase (Auth → Users → Add user)
--    ou use o CLI: supabase auth signup --email admin@meddoc.local --password admin123
-- 2. Pegue o UUID gerado e use abaixo para ajustar o role:

-- Exemplo (substitua os UUIDs pelos reais):
-- UPDATE profiles SET role = 'admin'    WHERE id = 'uuid-do-admin';
-- UPDATE profiles SET role = 'revisor'  WHERE id = 'uuid-do-revisor';
-- UPDATE profiles SET role = 'operador' WHERE id = 'uuid-do-operador';
-- UPDATE profiles SET name = 'Admin Demo'    WHERE id = 'uuid-do-admin';
-- UPDATE profiles SET name = 'Revisor Demo'  WHERE id = 'uuid-do-revisor';
-- UPDATE profiles SET name = 'Operador Demo' WHERE id = 'uuid-do-operador';

-- Prontuários de exemplo (sem arquivo — apenas metadados)
INSERT INTO prontuarios (patient_name, patient_cpf, record_number, document_type, document_date, status, pages, uploaded_by)
SELECT
  names.name,
  lpad((row_number() over())::text, 11, '0'),
  '2024-' || lpad((row_number() over())::text, 5, '0'),
  types.tp,
  CURRENT_DATE - (random() * 365)::int,
  statuses.st,
  (random() * 10 + 1)::int,
  (SELECT id FROM profiles LIMIT 1)
FROM
  (VALUES
    ('Ana Clara Ferreira'), ('Bruno Souza Lima'), ('Carla Mendes'),
    ('Diego Alves'), ('Elena Costa'), ('Fernando Rocha'),
    ('Gabriela Santos'), ('Henrique Oliveira'), ('Isabela Martins'),
    ('João Pedro Nunes')
  ) AS names(name),
  (VALUES ('Prontuário médico'), ('Exame laboratorial'), ('Laudo de imagem')) AS types(tp),
  (VALUES ('approved'), ('pending'), ('reproved')) AS statuses(st)
LIMIT 20
ON CONFLICT (record_number) DO NOTHING;
