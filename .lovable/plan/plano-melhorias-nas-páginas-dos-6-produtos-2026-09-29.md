# Plano: melhorias nas páginas dos 6 produtos

Entrega em 4 etapas, porque o pedido é grande. Cada etapa fica pronta e testável antes da próxima.

## Etapa 1 — Menu, Provas e base comum
- Menu: tirar "Conhecer Provas", "Conhecer Trabalhos", "Conhecer ENEM" etc.
- Provas: trocar "Aulas Gravadas por Professor: Provas" por 2 carrosséis:
  1. Resolução de provas (áreas de interesse do aluno): professores reais primeiro, depois professores virtuais.
  2. Revisões de conteúdo: mesma ordem.
- O mesmo par de carrosséis será usado em ENEM, OAB, Vestibulares e Concursos (filtrados pelo produto).
- Todas as escolhas do aluno passam a ser listas de seleção (sem digitação), alimentadas pelo painel.

## Etapa 2 — Trabalhos
- Cada Word e PPT é gerado do zero para cada pedido: nada reaproveitado de outros alunos (fim do cache compartilhado).
- Visual diferente a cada geração: sorteio de tema (cores, fontes, capa, disposição) sem repetir os já usados para o mesmo assunto.
- No lugar de "Aulas Gravadas por Professor: Trabalhos": área com os 2 arquivos do pedido atual para baixar. Sem pedido em andamento, a área não aparece.
- Duas ferramentas novas, exclusivas do trabalho gerado:
  - "Dicas para a apresentação ou aula" (dicas slide a slide).
  - "Perguntas que podem ser feitas na apresentação" (perguntas com respostas).

## Etapa 3 — Painel: configuração completa por produto
Em Produtos, para ENEM, OAB, Vestibulares e Concursos:
- Cadastro das opções das listas: áreas, anos, número do exame, fases, vestibulares, bancas, cargos, disciplinas.
- Cadastro de cada prova com seus dados próprios (ex.: OAB = número do exame, fase, data; ENEM = ano, dia/área, data; Vestibular = instituição, ano, fase; Concurso = banca, cargo, ano, fase) e importação do PDF com IA (já existe, será ligada a esse cadastro).
- Configuração do simulado por produto: tempo total, número de questões, blocos/cadernos, se tem redação ou discursivas, pontuação e nota de corte.

## Etapa 4 — Páginas ENEM, OAB, Vestibulares e Concursos
- Seleções:
  - ENEM: Área, Ano (mostra a data da prova), Simulado ou Resolução Comentada.
  - OAB: Número do Exame (mostra a data), Fase, Simulado ou Resolução Comentada.
  - Vestibulares: Vestibular, Ano, Fase, Simulado ou Resolução Comentada.
  - Concursos: Banca, Cargo, Disciplina, Ano, Fase, Simulado ou Resolução Comentada.
- Simulado real: cronômetro com o tempo oficial, questões na ordem e formato da prova, folha de respostas, entrega ao fim do tempo e resultado com nota.
- Correção de redação e discursivas por IA com os critérios de cada prova (ENEM: 5 competências de 0 a 200; OAB 2ª fase: peça e questões; vestibulares e concursos: critérios cadastrados no painel).
- Resolução Comentada: questões da prova escolhida com a resposta explicada logo abaixo de cada uma (gerada uma vez por questão e reaproveitada).
- Os 2 carrosséis da Etapa 1.

## Detalhes técnicos
- Novas tabelas: opções de seleção por produto, configuração de simulado por produto, tentativas de simulado e respostas, correções de redação, comentários por questão, histórico de temas usados em trabalhos. Todas com RLS e permissões (aluno vê só o que é seu; admin edita).
- Provas reais existentes ganham campos: número do exame, fase, data de aplicação, instituição/banca/cargo.
- IA de texto sempre `openai/gpt-6-astra`, no servidor, sem cobrar em caso de falha.
- Trabalhos: remover o reaproveitamento por tema na função de geração; tema visual escolhido no servidor e aplicado no Word/PPT.

## Pontos de atenção
- Os comentários das questões e as correções usam Créditos de IA do seu espaço.
- OAB, Vestibulares e Concursos só terão simulados depois que as provas forem importadas pelo painel.
