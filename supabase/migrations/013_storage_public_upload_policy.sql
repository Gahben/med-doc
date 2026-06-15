-- ============================================================
-- MedDoc - Migration 013: public upload for signed patient requests
-- ============================================================

-- The patient request form is public/anonymous, but the signed PDF is stored
-- in the private "prontuarios" bucket under patient_requests/.
DROP POLICY IF EXISTS "storage_public_upload_patient_requests" ON storage.objects;

CREATE POLICY "storage_public_upload_patient_requests"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'prontuarios'
  AND name LIKE 'patient_requests/%'
  AND lower(name) LIKE '%.pdf'
);

SELECT 'Migration 013 applied successfully.' AS status;
