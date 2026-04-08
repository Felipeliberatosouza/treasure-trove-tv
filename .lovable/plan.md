## Plano: Configurações da Plataforma (Admin)

### 1. Banco de Dados
- Criar tabela `platform_settings` com campos `key` (TEXT UNIQUE), `value` (JSONB), `updated_at`
- RLS: apenas admins podem ler/escrever; leitura pública para consumo no frontend

### 2. Nova aba "Configurações" no Admin Dashboard
Seções organizadas em sub-abas:

**a) Identidade Visual**
- Nome da plataforma, slogan
- URL do logotipo (ou upload)
- Cores primária, secundária, destaque

**b) Informações de Contato**
- Email, telefone, endereço
- Links de redes sociais

**c) Páginas Institucionais**
- Editor de texto para: Sobre Nós, Termos de Uso, Política de Privacidade

**d) Página Inicial**
- Seleção de vídeos em destaque
- Texto do banner hero, CTA

**e) Planos e Preços**
- Configuração de planos de assinatura (nome, preço, recursos)
- Preço padrão de vídeos individuais

### 3. Integração
- Criar hook `usePlatformSettings` para consumir configurações
- Atualizar páginas públicas para usar dados dinâmicos (progressivamente)

### 4. Arquivos afetados
- Nova migration SQL
- `AdminDashboard.tsx` - nova aba
- Novo componente `AdminSettingsTab.tsx` com sub-seções
- Novo hook `usePlatformSettings.ts`
