# Dúvidas de aulas com professor virtual (IA) — chat coletivo com professores

Hoje uma dúvida tem um professor fixo e uma resposta. Nas aulas de IA não há professor, então a dúvida vai para a administração e morre ali. Este plano transforma a dúvida de IA em um **chat aberto por disciplina**: todos os professores daquela área são chamados, respondem no mesmo histórico e o aluno interage conforme o plano (ou pagando com Créditos de IA).

## 1. Como vai funcionar para o aluno

- Abaixo da aula com professor virtual, o aluno envia a dúvida normalmente.
- A dúvida vira um chat: a pergunta dele e **todas** as respostas dos professores ficam no mesmo histórico, com o nome de cada professor.
- O aluno vê quantas interações ainda tem. Ao acabar:
  - com plano: mensagem informando o limite do plano;
  - sem plano (ou plano esgotado): opção de usar Créditos de IA, com o custo por interação exibido antes de confirmar.
- Interações ilimitadas quando o plano estiver configurado assim.

## 2. Como vai funcionar para o professor

- Nova seção **Dúvidas** no painel do professor, com duas listas: "Dúvidas abertas da minha área" e "Dúvidas que respondi".
- Ele entra no chat e responde; várias respostas de professores diferentes convivem no mesmo chat.
- Em Dados Pessoais, opção "Quero receber por e-mail as dúvidas da minha área". Quando ligada, recebe um e-mail (modelo editável em Configurações > E-mails) com o assunto da dúvida e **link direto para o chat**.
- Cada resposta aprovada soma no componente **Dúvidas** do RF Score.
- Se o administrador definir a taxa-bônus, cada resposta aprovada gera um valor a pagar, somado ao acerto mensal do professor.

## 3. Bloqueio de contatos e linguagem imprópria

Antes de gravar qualquer mensagem (aluno ou professor):
- detecta telefone, e-mail, endereços de site/rede social e tentativas disfarçadas ("arroba", "ponto com", números por extenso);
- detecta palavrões e xingamentos a partir de uma lista editável pelo administrador.

A mensagem é recusada na hora com aviso ao autor, gravada como **bloqueada** (não aparece para a outra parte) e sinalizada no painel do administrador em uma lista "Mensagens bloqueadas", com motivo, trecho detectado, autor e ação (liberar ou manter bloqueada).

## 4. Configurações no painel administrativo

Nova seção **Dúvidas** em Configurações:
- interações do aluno por dúvida **por plano**, com opção "ilimitado";
- interações para quem não tem plano;
- **custo em Créditos de IA por interação extra** com professores;
- prazo de resposta e quantos professores da área são notificados;
- **taxa opcional de bônus (R$) por dúvida respondida** paga ao professor;
- lista editável de palavras bloqueadas;
- texto do e-mail de convocação de professores (em Configurações > E-mails).

## 5. Documentos legais

Atualização de Termos de Uso (aluno e professor), Política de Privacidade e minuta de contrato do professor, cobrindo: chat coletivo de dúvidas, proibição de troca de contatos e de linguagem ofensiva com moderação automática, retenção/visibilidade das mensagens pela administração, consumo de Créditos de IA por interação e natureza eventual do bônus por dúvida respondida.

## Detalhes técnicos

**Banco (migrations aditivas)**
- `student_doubts`: `audience` ('teacher' | 'area'), `area_ids uuid[]`, `subject`, `interactions_limit` (NULL = ilimitado), `interactions_used`, `credits_spent`.
- `doubt_messages`: `blocked boolean`, `block_reason text`, `block_matches text[]`, `paid_with_credits boolean`, `bonus_amount numeric`. Novo status `blocked`.
- Nova `doubt_area_invites` (doubt_id, teacher_id, notified_at, responded_at) para controlar convocação e RF Score.
- Nova `doubt_teacher_rewards` (doubt_id, message_id, teacher_id, amount, status) alimentando o acerto mensal.
- `profiles.receives_doubt_emails boolean default true`.
- RLS: professor da área lê/escreve em dúvidas `audience='area'` que toquem suas áreas (`profiles.areas` ∩ `area_ids`) via função SECURITY DEFINER `can_teacher_access_doubt(uuid)`; aluno lê as próprias; mensagens `blocked` visíveis só para admin e autor. GRANTs na criação de cada tabela.
- Substituir `enforce_doubt_messages_limit` por versão que respeita `interactions_limit NULL` e consome crédito via RPC.

**Edge functions**
- `doubt-interaction` (nova): valida texto (moderação), aplica limite do plano, consome Créditos de IA quando necessário, grava a mensagem, cria o registro de bônus e dispara e-mails.
- `_shared/doubt-moderation.ts`: regex de telefone/e-mail/URL/@handle + normalização de acentos e leetspeak + lista de palavras da config.
- Templates novos em `_shared/transactional-email-templates/`: `doubt-area-invite` (professor) e `doubt-new-answer` (aluno), registrados no `registry.ts`.

**Frontend**
- `DoubtForm.tsx`: ao ser usado em conteúdo de IA, envia `audience='area'` + áreas do kit.
- `DoubtThreadDialog.tsx`: modo multi-professor (histórico com autor), aviso de limite, botão "usar Créditos de IA".
- Novo `TeacherDoubtsAreaTab` na aba Dúvidas do painel do professor.
- `AdminDoubtsTab`: sub-aba "Mensagens bloqueadas".
- Novo `settings/SettingsDoubts.tsx` registrado em `AdminSettingsTab`.
- `SettingsPages` / `SettingsTeacherContract`: textos legais atualizados.
- RF Score: `recompute-teacher-payments` passa a contar `doubt_area_invites.responded_at` e soma `doubt_teacher_rewards`.
