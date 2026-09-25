ALTER TABLE public.products ADD COLUMN IF NOT EXISTS subproducts jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.products SET subproducts = '[
{"key":"revisoes","name":"Revisões (Aula)","kind":"ai","tool":"revisao","active":true},
{"key":"resolucao","name":"Resolução de Provas (Aula)","kind":"link","href":"/revisoes","active":true},
{"key":"resumo","name":"Resumo One Page","kind":"ai","tool":"resumo","active":true},
{"key":"simulado","name":"Simulado","kind":"ai","tool":"simulado","active":true},
{"key":"top_questoes","name":"Top Questões de Provas Comentadas","kind":"ai","tool":"top_questoes","active":true},
{"key":"colinha","name":"Colinha","kind":"ai","tool":"colinha","active":true},
{"key":"aula_particular","name":"Aula Particular","kind":"link","href":"/#agendar-aula","active":true}
]'::jsonb WHERE key = 'provas';

UPDATE public.products SET subproducts = '[
{"key":"documento","name":"Documento Personalizado para Entrega","kind":"ai","tool":"trabalho","active":true},
{"key":"slides","name":"Slide Personalizado Apresentação","kind":"ai","tool":"trabalho","active":true},
{"key":"dicas","name":"Dicas para a apresentação ou aula","kind":"ai","tool":"trabalho","active":true},
{"key":"perguntas","name":"Perguntas que podem ser feitas na apresentação","kind":"ai","tool":"trabalho","active":true},
{"key":"aula_particular","name":"Aula Particular","kind":"link","href":"/#agendar-aula","active":true}
]'::jsonb WHERE key = 'trabalhos';

UPDATE public.products SET subproducts = jsonb_build_array(
 '{"key":"revisoes","name":"Revisões (Aula)","kind":"ai","tool":"revisao","active":true}'::jsonb,
 '{"key":"resolucao","name":"Resolução de Provas (Aula) - Últimos 5 anos","kind":"link","href":"/revisoes","active":true}'::jsonb,
 '{"key":"resumo","name":"Resumo de Conteúdos Específicos","kind":"ai","tool":"resumo","active":true}'::jsonb,
 '{"key":"simulado","name":"Simulado (Tendência e Últimas 5 provas por área)","kind":"ai","tool":"simulado","active":true}'::jsonb,
 jsonb_build_object('key','top_questoes','name', CASE WHEN key='vestibulares' THEN 'Top Questões de Provas' ELSE 'Top Questões de Provas Comentadas' END,'kind','ai','tool','top_questoes','active',true),
 '{"key":"colinha","name":"Colinha","kind":"ai","tool":"colinha","active":true}'::jsonb,
 '{"key":"aula_particular","name":"Aula Particular","kind":"link","href":"/#agendar-aula","active":true}'::jsonb
) WHERE key IN ('enem','vestibulares','oab','concursos');