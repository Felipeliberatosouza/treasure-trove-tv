# CI Workflows

## `ticket-attachments-rls.yml`

Roda o teste de integração `supabase/functions/_shared/__tests__/ticket-attachments-rls_test.ts`,
que valida em ambiente real:

- Dono do ticket lê apenas seus próprios anexos.
- Outro usuário autenticado **não** consegue ler nem baixar anexos alheios.
- Admin lê e baixa qualquer anexo.
- Storage policies do bucket `support-attachments` se comportam consistentemente.

### Quando dispara

- Em `push` para `main` e em qualquer `pull_request` que altere:
  - O próprio teste
  - O componente `TicketAttachments.tsx`
  - As abas de tickets (aluno e admin)
  - Migrations SQL relacionadas a attachments, support tickets, RLS ou policies
    (ex.: `*attachment*.sql`, `*support_ticket*.sql`, `*rls*.sql`, `*polic*.sql`)
  - Arquivos em `supabase/policies/**` que contenham `attachment`,
    `support_ticket` ou `rls` no nome
  - O próprio workflow
- Manualmente via **Run workflow** (workflow_dispatch).

> 💡 Outras migrations SQL **não** disparam o workflow — rode manualmente via
> **Run workflow** se precisar validar uma mudança que não casa com os
> padrões acima.

### Secrets obrigatórios (Settings → Secrets and variables → Actions)

| Secret                       | Descrição                                                                 |
| ---------------------------- | ------------------------------------------------------------------------- |
| `SUPABASE_URL`               | URL do projeto Lovable Cloud (ex.: `https://xxxx.supabase.co`).           |
| `SUPABASE_SERVICE_ROLE_KEY`  | Service-role key (cria/deleta usuários de teste). **Trate como sigilo.**  |
| `SUPABASE_ANON_KEY` _ou_ `SUPABASE_PUBLISHABLE_KEY` | Chave pública usada para login dos usuários de teste. |

> ⚠️ Recomendado rodar contra um projeto de **staging**. O teste cria 3 usuários
> com e-mail `rls-test-*@example.com` e os remove ao final.