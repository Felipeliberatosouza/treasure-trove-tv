CREATE TABLE public.support_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'Geral',
  question text NOT NULL,
  answer text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','archived')),
  source text NOT NULL DEFAULT 'seed' CHECK (source IN ('seed','learned','admin')),
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_faqs TO authenticated;
GRANT ALL ON public.support_faqs TO service_role;
ALTER TABLE public.support_faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage support faqs" ON public.support_faqs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  visitor_name text,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'bot' CHECK (status IN ('bot','waiting_human','human','closed')),
  handoff_reason text,
  handoff_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_conversations TO authenticated;
GRANT ALL ON public.support_conversations TO service_role;
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage support conversations" ON public.support_conversations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('customer','agent','human','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_messages_conv_idx ON public.support_messages(conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage support messages" ON public.support_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.platform_settings (key, value) VALUES ('support_agent', jsonb_build_object(
  'enabled', true,
  'agent_name', 'Clara',
  'greeting', 'Oi! Meu nome é Clara, sou da equipe da Revisão Fácil e estou aqui para te ajudar. Como posso te ajudar hoje?',
  'handoff_customer_message', 'Entendi! Já estamos analisando a sua solicitação com atenção. Aguarde só um pouquinho que alguém da nossa equipe vai continuar com você por aqui mesmo ou pelo WhatsApp.',
  'handoff_whatsapp', '',
  'style_notes', 'Fale como uma pessoa real: frases curtas, tom acolhedor, informal e educado. Use o nome do cliente quando souber.'
)) ON CONFLICT (key) DO NOTHING;

INSERT INTO public.support_faqs (category, question, answer) VALUES
('Plataforma','O que é a Revisão Fácil?','A Revisão Fácil é uma plataforma de revisão para provas: tem aulas gravadas por professores, aulas com professor virtual, resumos, simulados, colinhas e Top Questões, tudo focado no que mais cai nas provas.'),
('Plataforma','Qual a diferença entre Aulas Gravadas por Professor e Aula com Professor Virtual?','As Aulas Gravadas por Professor são feitas por professores reais da plataforma. A Aula com Professor Virtual é montada na hora sobre o assunto que você pedir, com slides narrados, destaques e questões para praticar.'),
('Plataforma','Como gero uma revisão sobre um assunto?','É só digitar o assunto da sua prova na caixa da página inicial e escolher o que quer: revisão, resumo, simulado, Top Questões, colinha ou Word e Slides de trabalho.'),
('Plataforma','A plataforma gera trabalho em Word e slides?','Gera sim! Escolha "Criar Word e Slides de Trabalho" na página inicial, digite o tema e depois é só baixar o Word e o PowerPoint. Você ainda pode pedir ajustes, como reduzir páginas ou colocar mais imagens.'),
('Plataforma','Onde encontro o que já gerei?','No menu do seu perfil ficam Minhas Revisões, Meus Resumos, Meus Simulados, Minhas Colinhas, Minhas Top Questões e Meus Trabalhos.'),
('Plataforma','Consigo usar pelo celular?','Consegue sim, a plataforma funciona no navegador do celular, tablet e computador. Para os vídeos, o celular na horizontal fica melhor.'),
('Créditos de IA','O que são Créditos de IA?','Os Créditos de IA são usados para criar materiais com a nossa ferramenta (revisões, trabalhos, ajustes e dúvidas extras). Você ganha alguns ao criar a conta, pode ganhar indicando amigos, receber no seu plano ou comprar pacotes.'),
('Créditos de IA','Meus Créditos de IA acabaram, o que faço?','Você pode comprar um pacote em "Comprar Créditos de IA" no menu, assinar um plano ou indicar amigos: cada amigo que abre o seu link te dá Créditos de IA.'),
('Créditos de IA','Como vejo meu saldo de Créditos de IA?','O saldo aparece no topo, logo abaixo do seu nome. No seu painel tem o extrato completo com o que você ganhou, comprou e usou.'),
('Indicação','Como funciona a indicação de amigos?','Você envia seu link por WhatsApp, SMS ou e-mail. Quando o amigo abre o link, você ganha Créditos de IA; quando ele faz a primeira compra, você ganha cashback.'),
('Indicação','Onde acompanho minhas indicações?','No seu painel, em "Minhas indicações", você vê para quem enviou, quando a pessoa abriu o link e se fez uma compra.'),
('Teste Grátis','Tem teste grátis?','Tem sim! Você pode ativar o teste grátis e conhecer as aulas e a ferramenta de revisão. As regras (dias ou número de acessos) aparecem na hora de ativar.'),
('Planos e Pagamento','Quais são os planos?','Os planos disponíveis ficam na seção de planos da página inicial, com o que cada um inclui e a quantidade de Créditos de IA por mês.'),
('Planos e Pagamento','Quais formas de pagamento vocês aceitam?','O pagamento é feito com cartão de crédito, de forma segura, direto na página de assinatura.'),
('Planos e Pagamento','Posso comprar só uma aula?','Pode sim, algumas aulas podem ser compradas avulsas, sem precisar assinar um plano.'),
('Planos e Pagamento','Como troco de plano?','No seu painel, em Assinatura, você pode mudar de plano. O sistema mostra antes a diferença de valor proporcional.'),
('Planos e Pagamento','Como cancelo minha assinatura?','O cancelamento é feito no seu painel, em Assinatura. Se o plano tiver fidelidade, as condições aparecem antes de confirmar.'),
('Planos e Pagamento','Posso pedir reembolso?','Pedidos de reembolso são analisados pela nossa equipe. Vou passar o seu caso para quem cuida disso, tudo bem?'),
('Conta','Esqueci minha senha, e agora?','Na tela de login clique em "Esqueci minha senha" e siga as instruções que chegam por e-mail ou celular.'),
('Conta','Não consigo entrar na minha conta','Confira o e-mail e a senha e tente "Esqueci minha senha". Se ainda assim não der, me conta o que aparece na tela que eu te ajudo.'),
('Conta','Como altero meus dados?','No seu painel, em Dados Pessoais, você atualiza nome, celular e interesses. O CPF não pode ser alterado depois do cadastro.'),
('Dúvidas','Como tiro dúvida sobre uma aula?','Abaixo de cada vídeo tem o campo de dúvidas. Os professores da disciplina respondem e você acompanha em Minhas Dúvidas.'),
('Aulas','Posso agendar aula particular com um professor?','Pode sim! Na página do professor ou no fim das revisões tem a opção de agendar uma aula com professor.'),
('Professores','Sou professor, como faço para dar aulas na plataforma?','É só fazer o cadastro de professor na página "Seja professor". Depois de aprovado, você publica suas aulas e recebe por visualização.'),
('Segurança','Meus dados estão seguros?','Estão sim. Seguimos a LGPD e você pode ver tudo na nossa Política de Privacidade.'),
('Atendimento','Quero falar com uma pessoa','Claro! Vou chamar alguém da equipe para continuar com você.');