# Melhorar as imagens e o preenchimento dos quadros da aula com professor virtual

## O que muda

### 1. Capa única e ligada ao conteúdo
Hoje a capa usa uma de três imagens fixas do projeto (ciências, exatas, humanas), então materiais diferentes acabam com a mesma capa. Passa a ser gerada uma imagem exclusiva para cada material, criada a partir do assunto e da disciplina, guardada uma única vez e reaproveitada em todas as aberturas. Enquanto a capa nova não fica pronta, a imagem temática atual continua aparecendo, sem tela vazia.

### 2. Imagem de fundo dos slides ligada ao conteúdo
Hoje só os slides que trazem uma descrição de imagem recebem ilustração própria; os demais caem na imagem fixa. Passa a valer para todos os slides: quando não há descrição, a imagem é criada a partir do título do slide, dos tópicos e do assunto. As imagens do slide seguinte são preparadas com antecedência para não haver troca brusca durante a narração.

### 3. Quadro que só preenche, nunca apaga
Hoje o quadro pode mostrar o conteúdo, apagar e reescrever, porque o que aparece é recalculado a cada instante da narração e volta atrás quando o áudio recomeça, é pausado ou o slide é revisitado. Passa a funcionar assim:
- o quadro começa vazio e cada linha entra conforme a narração chega ao ponto correspondente;
- o que já entrou permanece na tela até o fim do slide, mesmo com pausa, rebobinagem ou volta ao slide;
- para o público infantil, em vez de apagar a linha anterior, a última linha fica em destaque e as anteriores permanecem visíveis, menores;
- os tópicos dos slides comuns também passam a entrar um a um acompanhando a narração, em vez de aparecerem todos de uma vez.

## Detalhes técnicos

- `supabase/functions/study-slide-image/index.ts`: aceitar `slide_index: -1` como capa (artefato `cover`), montar prompt a partir de `assunto`/`disciplina`/`faixa_etaria` e, para slides sem `imagem_prompt`, compor o prompt com título e bullets. Manter cache em `ai_content_artifacts` + bucket `ai-revision-media`.
- `src/components/study/NarratedSlidesPlayer.tsx`:
  - buscar a capa (`slide_index: -1`) ao montar e usá-la em `coverImage`, com fallback para a imagem temática;
  - remover a condição `slide?.imagem_prompt` da geração por slide e pré-carregar o índice seguinte;
  - introduzir progresso monotônico por slide (`maxProgressRef` por índice) alimentando `visibleBoardSteps`, destaques e a revelação dos bullets, para que nada seja removido;
  - substituir `visibleBoardSteps.slice(-1)` no modo infantil por destaque na última linha, mantendo as anteriores.

## Fora do escopo
Trilha sonora de fundo e geração de arquivo de vídeo consolidado.
