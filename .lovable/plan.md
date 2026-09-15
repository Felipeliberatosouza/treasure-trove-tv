# Evolução do Revisão Fácil com IA — Kit de Revisão

Li o documento anexo. Ele descreve uma evolução grande: transformar o atual
"Estudar com IA" em uma experiência de **Kit de Revisão** com créditos,
cache de conteúdo, materiais completos (slides narrados com avatar, simulado,
Top Questões, PDF, colinha), ligações comerciais e painel administrativo.

Isso é grande demais para uma única entrega. Proponho fazer por etapas,
entregando valor utilizável a cada uma. Tudo continua dentro do site atual,
sem mexer no catálogo, login, planos, pagamentos ou simulados existentes.

## Etapa 1 — Base: créditos, cache e nova tela

- Nova tela da IA em `/revisao-ia` (a atual `/estudar-ia` passa a redirecionar),
  layout limpo e centralizado, com a pergunta
  "Qual o assunto da sua próxima prova, Felipe?" (versão genérica se deslogado).
- Campo grande de assunto, campos opcionais (disciplina, curso, instituição,
  data da prova), explicação do que será gerado e saldo de créditos.
- Regra de acesso controlada no servidor:
  - 1º uso: grátis e sem cadastro (cookie seguro + registro no servidor);
  - 2º uso: exige cadastro, que concede exatamente 2 créditos;
  - 3º uso: consome o 2º crédito;
  - depois do 3º: tela de conversão com planos, compra individual,
    pacote de créditos e aula particular.
- Cache canônico: antes de gastar crédito, procura um kit pronto equivalente
  (chave normalizada por disciplina/assunto/idioma/nível/versão de template).
  Entrega do cache não consome crédito.
- Ledger de créditos: reserva no início, confirma no fim, devolve em falha.
  Proteção contra duplo clique (idempotência) e limites por IP/sessão/usuário.

## Etapa 2 — Kit de Revisão (texto)

Uma única geração produz a estrutura reaproveitada por todos os formatos:

- resumo estruturado em seções;
- simulado (reutilizando o componente e o fluxo de simulados atuais);
- Top Questões com gabarito comentado;
- colinha em bullets;
- PDF gerado a partir da mesma estrutura (sem nova chamada de IA).

Tela de resultado com abas, tela de processamento por etapas, aviso de que o
conteúdo tem apoio de IA, botões de feedback e de reportar erro.

## Etapa 3 — Slides narrados e avatar

- Slides gráficos + narração em português + legendas, evoluindo o player atual.
- Avatar por disciplina, configurável no painel administrativo (um avatar fixo
  por área, caracterizado conforme a disciplina).
- Processamento assíncrono em fila com status pendente/processando/pronto/erro;
  resumo e simulado ficam disponíveis mesmo com o vídeo ainda renderizando.
- Vídeo/áudio guardados em cache e reaproveitados entre alunos.
- O provedor de vídeo/avatar entra por adaptador configurável — a plataforma
  atual não gera avatar falante nativamente, então a Etapa 3 depende de
  contratar um serviço externo.

## Etapa 4 — Monetização e administração

- Cards e páginas de planos passam a mostrar quantos kits de IA estão incluídos,
  se renovam, se acumulam e o que acontece quando acabam.
- Configuração de créditos no painel: créditos por plano, validade, preço de
  pacotes, conceder/retirar crédito, consultar consumo e auditar gerações.
- Blocos comerciais no resultado: agendar aula com professor do assunto,
  assistir aula gravada, conteúdo pago recomendado, planos, gerar outro kit.
- Moderação: professor/admin revisa, edita, aprova ou despublica material gerado.

## Etapa 5 — Conformidade e lançamento

- Política de Privacidade e Termos atualizados (prompts, arquivos enviados,
  histórico, provedores de IA, retenção e exclusão, direitos do titular).
- Testes com disciplinas variadas, uso anônimo, cache, falha com devolução de
  crédito e medição de custo por kit.

## Detalhes técnicos

- Banco: `ai_revision_sessions`, `ai_revision_requests`, `ai_revision_credits`,
  `ai_revision_credit_ledger`, `ai_canonical_contents`, `ai_content_artifacts`,
  `ai_generation_jobs`, `ai_generation_errors`, `ai_content_feedback`,
  `ai_prompt_versions`, `ai_provider_usage` — todas com GRANT + RLS.
- Edge functions: `ai-revision-start` (cache → crédito → job),
  `ai-revision-job` (geração por etapas), `ai-revision-artifact`
  (PDF/áudio sob demanda), evoluindo `study-agent` e `study-tts` atuais.
- Chaves de IA permanecem no servidor; custo, modelo, tokens, tempo e status
  são registrados por job.
- Modelos baratos para classificação/normalização; modelo mais capaz só para a
  geração do kit. Sem regeneração automática em loop.

## O que sugiro agora

Implementar a **Etapa 1 e a Etapa 2** nesta rodada: nova tela, regra de
créditos no servidor, cache e o Kit de Revisão completo em texto (resumo,
simulado, Top Questões, colinha e PDF). Slides com avatar, planos e painel
administrativo entram nas rodadas seguintes.
