-- ============================================================
-- MedDoc — Migração 013: Permite upload público de solicitações assinadas
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Permite que qualquer usuário (incluindo anônimos/públicos) faça upload na pasta patient_requests/
DROP POLICY IF EXISTS "storage_public_upload_patient_requests" ON storage.objects;

CREATE POLICY "storage_public_upload_patient_requests" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'prontuarios' 
    AND (position('patient_requests/' in name) = 1)
  );

SELECT 'Migração 013 aplicada com sucesso!' AS status;
