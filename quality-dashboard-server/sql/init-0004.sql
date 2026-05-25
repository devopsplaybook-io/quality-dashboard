-- Fix has_file and file_entrypoint for existing JSON processor versions
-- that were uploaded as jsonPayload (data.json was written but flags not set)
UPDATE report_versions
SET has_file = 1, file_entrypoint = 'data.json'
WHERE processor = 'json' AND has_file = 0;
