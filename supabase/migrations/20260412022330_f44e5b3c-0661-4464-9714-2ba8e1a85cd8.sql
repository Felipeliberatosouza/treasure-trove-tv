-- Update contract template: change foro to São Paulo
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{contract_body}',
  to_jsonb(
    replace(
      value->>'contract_body',
      'Fica eleito o foro da comarca da sede da {{razao_social}} para dirimir quaisquer dúvidas ou controvérsias oriundas deste contrato.',
      'Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer dúvidas ou controvérsias oriundas deste contrato.'
    )
  )
),
updated_at = now()
WHERE key = 'teacher_contract_template';

-- Add corporate fields to contact settings if they don't exist
UPDATE platform_settings
SET value = value
  || '{"razao_social": "", "nome_fantasia": "", "cnpj": "", "platform_address": ""}'::jsonb,
updated_at = now()
WHERE key = 'contact'
AND NOT (value ? 'razao_social');
