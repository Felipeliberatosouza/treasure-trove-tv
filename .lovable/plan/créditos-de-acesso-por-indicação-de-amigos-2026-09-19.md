# Créditos de acesso por indicação de amigos

Hoje o programa de indicação só gera cashback quando o indicado faz a 1ª compra. Vamos criar um segundo prêmio: **créditos de acesso a conteúdos** (e créditos de IA) liberados assim que o amigo indicado entra na plataforma pelo link do convite.

## 1. Painel administrativo (Cashback)

Novo bloco "Indicação para acesso à IA e conteúdos", logo abaixo de "Programa de Indicação", na mesma tela do print:

- Liga/desliga o prêmio por acesso.
- Um campo de quantidade para cada conteúdo: Revisões, Resumos, Simulados, Top Questões, Colinhas, Dúvidas, Aula particular e Créditos de IA (geração de material).
- Limite máximo de indicações premiadas por aluno (0 = sem limite).
- Texto explicando que o prêmio é concedido quando o amigo acessa pelo link enviado.

Tudo salvo junto da configuração de cashback existente, no mesmo botão "Salvar configurações".

## 2. Tela de convite do aluno

No quadro "Convide e ganhe" (home, avisos de crédito esgotado, checkout, troca de plano, pagamento confirmado):

- Mostrar o que o aluno ganha por acesso, conforme configurado pelo admin.
- Campo de e-mail (já existe) + novo campo de **celular com máscara (XX) XXXXX-XXXX**.
- Botões de envio: **E-mail**, **WhatsApp** e **SMS** — cada envio gera um link de convite exclusivo daquele contato.
- Continuam os botões de compartilhamento livre (WhatsApp, X, LinkedIn, Telegram) e copiar link.
- Lista simples dos convites enviados com situação: enviado / acessado / premiado.

## 3. Como o prêmio é medido

1. Ao enviar um convite, é criado um registro com o contato (e-mail ou celular), o canal e um código único.
2. O link enviado é `revisaofacil.com.br/convite/<código>`.
3. Quando alguém abre esse link: o convite é marcado como acessado, o código de indicação fica guardado no navegador, e a pessoa segue para o cadastro.
4. O prêmio para quem indicou é creditado nesse momento (uma vez por convite/contato), respeitando o limite de indicações premiadas.
5. Proteções: um mesmo contato só premia uma vez; o próprio aluno abrindo o próprio link não premia; convites vencem em 60 dias.
6. O cashback sobre a 1ª compra continua funcionando exatamente como hoje, em paralelo.

## 4. Onde os créditos aparecem

Os créditos de acesso ganhos entram como saldo extra do aluno: liberam acesso a revisões, resumos, simulados, top questões, colinhas, dúvidas e aula particular mesmo sem plano, e são consumidos antes de cair na tela de compra avulsa. Os créditos de IA entram no saldo de geração já existente.

## Detalhes técnicos

- `platform_settings.cashback_program` ganha `referral_access_enabled`, `referral_access_grants` (por `resource_type` + `ai_credits`) e `referral_access_max_rewards`; tipos em `useCashback.ts` e UI em `SettingsCashback.tsx`.
- Nova tabela `referral_invites` (referrer_user_id, channel, contact_email, contact_phone, token único, status, sent_at, visited_at, rewarded_at, visitor_user_id) com RLS: dono vê/cria os seus, admin vê tudo, service_role gerencia.
- Nova tabela `referral_content_credits` (user_id, resource_type, granted, used) + RPC `consume_referral_content_credit(_resource_type)`; `useResourceLimit` soma esse saldo ao limite do plano e o consome antes do paywall.
- Edge function `referral-invite` (verify_jwt=false, valida JWT em código): ações `send` (cria convite, dispara e-mail via `send-transactional-email` ou SMS/WhatsApp via Twilio, usando o padrão de `send-phone-code`) e `claim` (valida token, marca acesso, credita `referral_content_credits` e `ai_revision_credits` + linha no `ai_revision_credit_ledger`).
- Rota pública `/convite/:token` chama `claim`, grava `ref` em localStorage e redireciona para `/signup/student?ref=...`.
- Novo template transacional `referral-access-invite` (com fallback para `cashback-referral-share` se não existir).
