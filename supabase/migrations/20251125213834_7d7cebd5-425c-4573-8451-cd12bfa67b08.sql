-- Recreate view with SECURITY INVOKER to address security linter warning
DROP VIEW IF EXISTS prompts_view;

CREATE VIEW prompts_view
WITH (security_invoker = true)
AS
SELECT 
  prompt_text,
  to_char(created_at, 'Mon DD, HH12:MI AM') as date_created
FROM prompts
ORDER BY created_at DESC;