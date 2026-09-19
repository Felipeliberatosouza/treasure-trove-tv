# Plano: Qualidade didática das Aulas com Professor Virtual

## Objetivo

Transformar os slides narrados em aulas mais didáticas e adequadas à idade do público, com palavras-chave destacadas no momento certo, linguagem e imagens adaptadas e uma lousa virtual que mostre explicações passo a passo.

## Decisões definidas

- A faixa etária será **detectada automaticamente** a partir do pedido, disciplina, curso e contexto informado.
- Quando não houver informação suficiente, será usado o padrão atual da plataforma: **jovens universitários de 18 a 25 anos**.
- A lousa será um **traçado sincronizado**, sem gerar um vídeo separado: números, palavras, setas, fórmulas e etapas aparecerão conforme a narração.
- Haverá **dois níveis de reforço**: legenda acessível com termos destacados e uma frase didática curta dentro do slide.

## Experiência da aula

### 1. Palavras e frases importantes

- Cada slide terá poucas palavras-chave selecionadas pela IA, sem destacar toda a narração.
- Durante a fala, uma frase didática curta aparecerá dentro do slide e destacará de 1 a 3 termos no momento correspondente.
- A legenda continuará disponível e destacará os mesmos termos, mantendo o texto completo para acessibilidade.
- Os destaques usarão peso, contraste e movimento leve, sem depender apenas de cor.
- Em celulares, a frase didática ocupará o espaço dos tópicos, evitando sobreposição com avatar, legenda e controles.

### 2. Padrões por faixa etária

A geração classificará o pedido em uma destas seis faixas:

1. **Crianças — 0 a 9 anos:** frases muito curtas, palavras simples, repetição positiva, exemplos concretos, ilustrações lúdicas, um passo por vez e animações mais visíveis.
2. **Pré-adolescentes — 10 a 13 anos:** linguagem simples sem infantilização excessiva, desafios curtos, comparações com escola e cotidiano e lousa guiada.
3. **Adolescentes — 14 a 17 anos:** linguagem direta, exemplos de estudo e vida cotidiana, dicas de prova e explicações progressivas.
4. **Jovens universitários — 18 a 25 anos:** padrão universitário atual, com exemplos práticos, termos técnicos explicados e foco em prova.
5. **Adultos — 26 a 45 anos:** linguagem objetiva, aplicações profissionais e cotidianas e menor uso de elementos lúdicos.
6. **Adultos maduros — acima de 46 anos:** ritmo visual mais calmo, maior legibilidade, frases claras, menos elementos simultâneos e exemplos familiares.

A faixa detectada será armazenada com o material e exibida na Gestão de Materiais de IA, onde o administrador poderá corrigi-la.

### 3. Lousa virtual sincronizada

- A IA decidirá em quais slides a lousa ajuda de verdade; ela não será usada em todos.
- Cada explicação de lousa será dividida em passos estruturados, ligados a trechos da narração.
- O player simulará escrita progressiva, sublinhados, setas, círculos, operações e pequenos desenhos didáticos.
- Em uma soma, por exemplo, aparecerão a conta, as unidades, o “vai um”, as dezenas e o resultado, na mesma ordem da explicação falada.
- Para crianças, será mostrado um passo por vez. Para públicos mais velhos, os passos poderão permanecer na tela e formar o raciocínio completo.
- A lousa substituirá temporariamente a área de tópicos do slide; não será uma camada adicional sobre o conteúdo.
- Quem preferir menos movimento terá transições reduzidas automaticamente.

### 4. Imagens e animações adequadas

- A direção visual de capa e slides passará a considerar assunto e faixa etária.
- Crianças receberão ilustrações amigáveis, formas simples e movimento lúdico; públicos mais velhos receberão visuais progressivamente mais técnicos e sóbrios.
- As imagens serão geradas e armazenadas uma vez por material, evitando nova cobrança e mudança visual a cada reprodução.
- Kits antigos continuarão funcionando com as imagens atuais; os novos usarão o padrão aprimorado.

## Fluxo de geração

1. Interpretar o pedido e detectar a faixa etária, com nível de confiança.
2. Usar a faixa na chave de reaproveitamento, impedindo que um material infantil reutilize uma versão universitária do mesmo assunto.
3. Gerar o Kit de Revisão com linguagem, exemplos, ritmo, palavras-chave, frases didáticas, imagens e passos de lousa adequados.
4. Validar os campos e remover destaques que não existam na narração.
5. Gerar e armazenar capa e imagens dos slides.
6. Manter a geração de voz conforme o avatar e preparar o áudio de cada slide.
7. Abrir a mesma tela unificada de conteúdo já usada hoje.

## Gestão de IA

Em **Gestão de IA → Gestão de Materiais de IA**:

- mostrar e permitir alterar a faixa etária detectada;
- editar palavras-chave e a frase didática de cada slide;
- editar, adicionar, remover e reordenar passos da lousa;
- editar a orientação da imagem;
- indicar quando áudio ou imagem precisa ser gerado novamente após uma edição;
- preservar a edição atual de título, tópicos, narração, disciplina e áreas.

## Detalhes técnicos

- Ampliar o contrato do slide com campos opcionais para compatibilidade com materiais antigos:
  - `frase_didatica`;
  - `palavras_chave` com termo e trecho-âncora da narração;
  - `modo_visual` (`conteudo`, `lousa` ou `avatar`);
  - `lousa_passos` com tipo, conteúdo, destaque e trecho-âncora;
  - `imagem_prompt` adaptado à faixa etária.
- Registrar `faixa_etaria` e `confianca_faixa_etaria` no conteúdo canônico e na solicitação.
- Fazer a detecção antes da consulta ao cache: primeiro por sinais explícitos no pedido e, quando necessário, por classificação da IA. Sem evidência suficiente, usar 18–25 anos.
- Incluir a faixa etária na chave do cache e atualizar as versões de modelo de conteúdo para não reutilizar kits antigos incompatíveis.
- Gerar imagens pelo serviço de IA no servidor e armazená-las como artefatos privados com links temporários, seguindo o fluxo já usado pelo áudio.
- Sincronizar palavras-chave e passos pelo trecho-âncora encontrado na narração e pela posição proporcional no áudio. Se uma edição administrativa remover a âncora, distribuir os passos de forma uniforme como fallback.
- Criar um componente de lousa com elementos seguros e limitados (texto, operação, seta, linha, círculo e desenho simples), sem executar código ou HTML gerado pela IA.
- Preservar integralmente reprodução, voz por gênero do avatar, legenda, VLibras, barra de tempo global, avanço entre slides e controles atuais.
- Respeitar redução de movimento e manter contraste, foco e leitura em telas pequenas.

## Critérios de aceite

- Um pedido explícito para uma criança de 7 anos gera linguagem, imagem, ritmo e recursos diferentes do mesmo assunto para uma pessoa universitária.
- Pedidos representativos de 7, 12, 16, 21, 35 e 55 anos são classificados nas seis faixas corretas.
- Um pedido ambíguo mantém o padrão universitário de 18–25 anos.
- Poucas palavras relevantes são destacadas no momento da fala, tanto na frase didática quanto na legenda.
- Uma explicação de adição mostra a conta sendo construída passo a passo na lousa, sincronizada com a narração.
- A lousa, a legenda, o avatar e os controles não se sobrepõem no celular.
- A barra de tempo continua única para toda a aula.
- Materiais de faixas diferentes nunca compartilham indevidamente o mesmo cache.
- O administrador consegue corrigir a faixa etária e editar destaques e passos da lousa.
- Materiais antigos continuam abrindo normalmente.

## Entrega em fases

1. Classificação etária, novos campos do Kit e separação correta do cache.
2. Geração de linguagem, exemplos, frases didáticas e palavras-chave por faixa.
3. Destaques sincronizados na frase didática e na legenda.
4. Lousa virtual com traçado e passos sincronizados.
5. Imagens adaptadas por idade, geração e armazenamento dos artefatos.
6. Controles administrativos para faixa, destaques, lousa e regeneração.
7. Validação completa em desktop e celular com os seis exemplos de idade.
