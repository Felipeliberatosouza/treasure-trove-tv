## Objetivo

Tornar todo o app auto-adaptável ao **plano de fundo** escolhido em Configurações → Identidade Visual: quando o fundo for **claro**, textos, banners, caixas, botões e a logomarca ficam legíveis num tema claro; quando for **escuro**, tudo se ajusta ao tema escuro atual — sem precisar reconfigurar cada token individualmente.

## Como vai funcionar

1. **Detecção automática de modo (claro/escuro)** a partir da cor de fundo (`background_color`) usando luminância WCAG. O resultado é gravado no `<html>` como `data-theme="light"` ou `data-theme="dark"`.

2. **Dois conjuntos completos de tokens semânticos** em `src/index.css`:
   - Tokens atuais permanecem para `data-theme="dark"` (default).
   - Novo bloco `[data-theme="light"]` com valores claros para: `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--sidebar-*`, `--gradient-hero`, `--gradient-card-hover`, `--shadow-glow`.
   - Componentes (banners, cards, inputs, modals, footer) já usam esses tokens, então herdam automaticamente.

3. **Auto-contraste inteligente** em `DynamicBranding.tsx`:
   - Se o admin definir apenas o fundo (sem `foreground`/`card`/`muted`), o sistema deriva automaticamente os tokens de texto e superfícies com contraste ≥ 4.5 (AA), usando as helpers `hexLuminance` e `ensureContrast` já existentes.
   - Se o admin definir cores explícitas em Identidade Visual, elas prevalecem — mas o sistema valida contraste e faz fallback para preto/branco quando necessário (padrão que já usamos em `selection-chip`).

4. **Logomarca adaptativa**:
   - Novo campo opcional em Configurações → Identidade Visual: **"Logomarca para fundo claro"** (upload de PNG).
   - `Navbar`, `Footer` e e-mails escolhem automaticamente `logo_url_light` quando `data-theme="light"` e caem para `logo_url` no escuro.
   - Se nenhuma versão clara for enviada, aplicamos um filtro `invert` como fallback e mostramos aviso no painel.

5. **Banners e caixas coloridas**:
   - `HeroBanner`, `SecondaryBanner`, `FreeTrialBanner`, `SubscriptionUnavailableBanner`, `PastDueBillingAlert`, `LessonReminderPreferences` e o `SettingsAlertBox` passam a ler `--card`/`--muted` semânticos em vez de cores fixas.
   - Onde há gradiente hero, o CSS `--gradient-hero` recalcula opacidade conforme o tema.

6. **Preview no admin**:
   - Em `SettingsBranding.tsx` acrescento um botão **"Prévia do tema"** que alterna `data-theme` só para o painel, para o admin ver antes de salvar.
   - Aviso automático quando o contraste texto/fundo ficar abaixo de AA.

## Escopo dos arquivos

**Editar:**
- `src/index.css` — bloco `[data-theme="light"]` completo.
- `src/components/DynamicBranding.tsx` — set `data-theme` conforme luminância; derivar tokens quando faltantes; injetar logomarca clara.
- `src/components/admin/settings/SettingsBranding.tsx` — novo upload `logo_url_light`, prévia de tema, indicadores de contraste.
- `src/hooks/usePlatformSettings.ts` — expor `logo_url_light`.
- `src/components/Navbar.tsx`, `src/components/Footer.tsx` — trocar logomarca conforme tema.
- `src/components/HeroBanner.tsx`, `SecondaryBanner.tsx`, `FreeTrialBanner.tsx`, `SubscriptionUnavailableBanner.tsx`, `SettingsAlertBox.tsx`, `LessonReminderPreferences.tsx` — remover cores hard-coded e usar tokens.

**Não muda:** lógica de negócio, tabelas do banco (só um novo campo JSON dentro de `platform_settings.branding`), rotas, e-mails transacionais (usarão a variante clara automaticamente pelo mesmo campo).

## Nota técnica

Nenhuma migração SQL é necessária: `logo_url_light` entra no JSONB `branding` já existente. O contrato de contraste usa WCAG 2.1 AA (4.5:1 texto normal, 3:1 texto grande). O switch de tema é puramente CSS via atributo `data-theme`, sem re-render React em componentes.

## Confirmação

Como o escopo toca muitos componentes visuais, quer que eu implemente **tudo de uma vez** ou prefere fazer em duas fases:
- **Fase 1:** motor de tema claro/escuro + auto-contraste + logomarca adaptativa (invisível até você escolher um fundo claro no admin).
- **Fase 2:** varredura fina de banners/caixas restantes que ainda tenham cor fixa.
