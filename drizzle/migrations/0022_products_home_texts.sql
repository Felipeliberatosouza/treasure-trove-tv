ALTER TABLE public.products ADD COLUMN IF NOT EXISTS badge text NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS headline text NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS input_hint text NOT NULL DEFAULT '';
UPDATE public.products SET
  badge = CASE key
    WHEN 'provas' THEN 'Seu Kit de Revisão completo em poucos minutos'
    WHEN 'trabalhos' THEN 'Seu trabalho escolar pronto: documento do Word e slides para entrega ao professor e apresentação!'
    WHEN 'enem' THEN 'Estude pelas quatro áreas do exame com foco no que mais cai!'
    WHEN 'vestibulares' THEN 'Revisão para os principais vestibulares do país, com foco no conteúdo que mais cai!'
    WHEN 'oab' THEN 'Revisão para a 1ª e a 2ª fase do Exame da Ordem'
    WHEN 'concursos' THEN 'Revisão direcionada por banca, cargo e disciplinas do edital'
    ELSE badge END,
  headline = CASE key
    WHEN 'provas' THEN 'Qual o assunto da sua próxima prova?'
    WHEN 'trabalhos' THEN 'Quer gerar documento Word e slides para um trabalho?'
    WHEN 'enem' THEN 'Qual a área do ENEM quer ver revisões, simulados, top questões?'
    WHEN 'vestibulares' THEN 'Para qual vestibular e matéria quer revisar?'
    WHEN 'oab' THEN 'Qual matéria da OAB quer revisar?'
    WHEN 'concursos' THEN 'Para qual concurso e disciplina quer revisar?'
    ELSE headline END,
  input_hint = CASE key
    WHEN 'provas' THEN 'Digite o assunto ou tópicos da sua prova (seja detalhista para ter melhores resultados!)'
    WHEN 'trabalhos' THEN 'Digite o assunto ou tópicos do seu trabalho (seja detalhista para ter melhores resultados!)'
    WHEN 'enem' THEN 'Digite a área, o assunto ou tópicos do ENEM (seja detalhista para ter melhores resultados!)'
    WHEN 'vestibulares' THEN 'Digite o vestibular, a matéria ou tópicos (seja detalhista para ter melhores resultados!)'
    WHEN 'oab' THEN 'Digite a fase, a matéria ou tópicos da OAB (seja detalhista para ter melhores resultados!)'
    WHEN 'concursos' THEN 'Digite a banca, o cargo ou as disciplinas do edital (seja detalhista para ter melhores resultados!)'
    ELSE input_hint END;