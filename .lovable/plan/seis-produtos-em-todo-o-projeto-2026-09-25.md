# Seis produtos em todo o projeto

Produtos: Provas, Trabalhos, ENEM, Vestibulares, OAB, Concursos Públicos.

## O que muda para cada pessoa

**Visitante**
- Menu com "Produtos" levando às 6 páginas.
- Cada produto ganha página própria (/provas, /trabalhos, /enem, /vestibulares, /oab, /concursos) com texto, gerador próprio e os planos daquele produto.
- Gerador com campos do produto: ENEM (área), Vestibulares (instituição), OAB (fase e disciplina), Concursos (banca, cargo, disciplina).

**Aluno**
- Menu "Meus conteúdos" separado por produto (Meus materiais de ENEM, OAB etc.).
- Todo material gerado fica marcado com o produto.

**Professor**
- Ao publicar aula ou resolução de questões, escolhe o produto (um ou mais).
- Menu mostra suas aulas separadas por produto.

**Administrador**
- Nova aba "Produtos": ativar/desativar, ordem, nome, ícone, textos da home e da página de cada produto.
- Planos: cada plano passa a pertencer a um produto (ex.: Plano ENEM, Plano OAB). Tela de planos mostra os planos agrupados por produto.
- Filtro por produto nas listas de conteúdos, aprovações e materiais de IA.

**Textos gerais**
- Revisão dos textos da home, planos, rodapé, Sobre, Termos, e-mails e atendente Clara para citar os 6 produtos.
- Perguntas do FAQ/Clara sobre ENEM, Vestibulares, OAB e Concursos adicionadas para você revisar.

## Pontos de atenção
- Assinaturas atuais continuam valendo e ficam como "Provas e Trabalhos" (o que existe hoje).
- Os planos novos de ENEM, Vestibulares, OAB e Concursos serão criados vazios; você define preços no painel.
- Textos novos serão escritos por mim; revise antes de publicar.

## Detalhes técnicos
- Tabela `products` (key, nome, ícone, textos, ativo, ordem) + GRANT/RLS (leitura pública, escrita admin).
- Coluna `product_keys text[]` em `lessons`, `exam_solutions`, `ai_canonical_contents`, `work_documents`; `product_key` em `subscription_plans` (padrão `provas`).
- Checagem de acesso: assinatura libera conteúdos cujo produto coincide com o do plano.
- Edge `ai-revision-kit` recebe `product_key` e campos extras no prompt e na chave de cache.
- Rota dinâmica `/:produto` via componente `ProductPage`; home lê produtos do banco em vez da lista fixa.
- Navbar/UserMenu por perfil com itens por produto.
