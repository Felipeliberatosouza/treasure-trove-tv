# Plano: Entrega unificada do conteúdo por IA

## Objetivo
Fazer o conteúdo gerado por IA abrir na mesma experiência usada pelos conteúdos cadastrados por professores, substituindo o vídeo inicial por uma capa dos slides e oferecendo a apresentação audiovisual completa.

## Implementação
1. Reaproveitar a tela existente de conteúdo, seus controles e áreas complementares, alimentando-a com o resultado canônico do Kit de Revisão.
2. Criar uma capa visual do conteúdo de IA no espaço principal onde hoje aparece o vídeo da aula, com ação para iniciar os slides.
3. Evoluir os slides para incluir imagens relacionadas, avatar por disciplina, narração, trilha/áudio e legendas sincronizadas.
4. Manter o resumo, simulado, Top Questões, colinha e materiais na mesma hierarquia visual do conteúdo de professor.
5. Preservar cache e reutilização: os recursos audiovisuais serão gerados uma vez por conteúdo canônico e reaproveitados entre alunos.

## Detalhes técnicos
- Adaptar o modelo de dados da IA ao contrato esperado pela tela existente, evitando uma segunda interface de entrega.
- Persistir artefatos e estados de processamento para capa, imagens, áudio, legendas e vídeo/apresentação.
- Exibir o conteúdo textual assim que estiver pronto; recursos audiovisuais poderão indicar processamento até ficarem disponíveis.
- Usar ferramentas de geração de imagem, voz e vídeo no servidor, sem expor chaves.
- Validar acessibilidade das legendas e comportamento responsivo.

## Critérios de aceite
- Conteúdo de professor e conteúdo de IA usam o mesmo layout de entrega.
- A abertura do conteúdo de IA mostra uma capa dos slides no espaço principal.
- A apresentação contém imagens, avatar, narração audível e legendas sincronizadas.
- O aluno ainda acessa todas as partes do Kit de Revisão.
- Nenhuma mudança quebra catálogo, login, compras ou conteúdos existentes.
