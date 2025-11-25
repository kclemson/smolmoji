-- Create view for prompts with user-friendly formatting
CREATE VIEW prompts_view AS
SELECT 
  prompt_text,
  to_char(created_at, 'Mon DD, HH12:MI AM') as date_created
FROM prompts
ORDER BY created_at DESC;