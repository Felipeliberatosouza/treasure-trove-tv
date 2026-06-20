# Player com thumbnails + pré-carregamento

Adicionar pré-visualização de seek estilo Netflix/YouTube (sprite + arquivo WebVTT) gerado no upload, e reduzir o tempo até dar play usando `preload="metadata"` + prefetch da URL assinada quando o card entra na tela ou recebe hover.

## O que muda para o usuário

- Ao passar o mouse na barra de progresso, aparece uma miniatura do trecho.
- Vídeos abrem mais rápido: assim que o cartão fica visível ou recebe hover, a URL assinada começa a ser preparada em segundo plano e o player já pede só os metadados.
- Vale para o player principal (assistir aula) e para a pré-visualização de 20%.

## Como será feito (detalhes técnicos)

### 1. Banco e storage
- Migration adicionando ao `lessons` e `exam_solutions`:
  - `preview_sprite_url TEXT` (URL pública do sprite JPEG)
  - `preview_vtt_url TEXT` (URL pública do WebVTT que aponta para o sprite com `#xywh=`)
  - `preview_status TEXT DEFAULT 'pending'` (`pending|ready|failed`)
- Novo bucket público `video-previews` (sprite + .vtt), com policies de leitura pública e escrita só para service role.
- Reaproveitar `subtitles_url` se já existir; senão adicionar como TEXT também (a auditoria indicou divergência).
- GRANTs e RLS conforme padrão do projeto.

### 2. Edge function `generate-video-preview`
- Disparada pelo `ContentForm` logo após o upload do vídeo terminar, recebendo `{ table, id, storage_path }`.
- Valida JWT manualmente, confere que o usuário é o `teacher_id` dono.
- Baixa o vídeo do bucket `videos` via service role (range/stream).
- Usa `ffmpeg` (camada Deno via `npm:@ffmpeg-installer/ffmpeg` + `npm:fluent-ffmpeg`) para:
  - amostrar 1 frame a cada N segundos (N = `max(2, duração/40)` para limitar a ~40 frames)
  - escalar para 160x90
  - montar sprite 8 colunas (`tile=8xN`) em JPEG q=4
- Gera `.vtt` com cues `mm:ss.mmm --> mm:ss.mmm` apontando para `sprite.jpg#xywh=col*160,row*90,160,90`.
- Faz upload de `sprite.jpg` e `thumbs.vtt` em `video-previews/{lesson_id}/` e atualiza colunas `preview_sprite_url`, `preview_vtt_url`, `preview_status='ready'`.
- Em erro, grava `preview_status='failed'` e retorna 200 com `{ ok:false }` (padrão do projeto).

### 3. Player (`src/components/VideoPlayer.tsx`)
- Adicionar props `previewVttUrl?: string`, `posterUrl?: string`.
- `<video preload="metadata" poster={posterUrl}>` (hoje não tem `preload` explícito).
- Parser leve de WebVTT (sem dependências) que cacheia os cues parseados e, no `onMouseMove` da barra de progresso, mostra um `<div>` posicionado com `background-image: url(sprite)` + `background-position` derivado do `#xywh`.
- Em mobile, mostra o thumbnail também durante drag do seek.
- Fallback: se `previewVttUrl` ausente ou falhou de carregar, mantém o comportamento atual (sem thumb).
- Respeitar `previewLimit` existente (não permitir hover-seek além de 20% para não autenticados).

### 4. Prefetch da URL assinada
- Novo hook `useSignedVideoUrl(storagePath)` que encapsula a lógica hoje inline em `VideoPage.tsx` (`resolveVideoPlaybackUrl`).
- Nos cards de vídeo da home/listagem (`ContentCard` / `VideoCard`), ao entrar no viewport (IntersectionObserver) **ou** ao receber `onMouseEnter`/`onFocus`, chamar uma versão "warm" que apenas gera a signed URL e a guarda em um `Map<lessonId, { url, expiresAt }>` em memória (TTL de 50 min).
- `VideoPage` consome esse cache: se já existe URL válida, pula a geração e vai direto para `setVideoUrl`, reduzindo o TTFB do play.
- Também adicionar `<link rel="preconnect">` para o domínio do storage no `index.html` para acelerar o handshake.

### 5. Ingestão retroativa
- Botão "Gerar pré-visualização" no painel admin de conteúdo (lista de moderação) que dispara `generate-video-preview` para vídeos com `preview_status != 'ready'`.
- Sem job em massa automático — só sob demanda — para evitar custo inesperado.

## Arquivos afetados

```text
supabase/migrations/<timestamp>_video_preview_sprites.sql   (novo)
supabase/functions/generate-video-preview/index.ts          (novo)
src/components/VideoPlayer.tsx                              (props + hover thumb + preload)
src/components/dashboard/ContentForm.tsx                    (chamar a função após upload)
src/pages/VideoPage.tsx                                     (passar previewVttUrl, usar cache)
src/hooks/useSignedVideoUrl.ts                              (novo)
src/lib/signedUrlCache.ts                                   (novo, em memória)
src/components/ContentCard.tsx (e similares)                (prefetch ao ver/hover)
src/components/admin/...                                    (botão de regenerar preview)
index.html                                                  (preconnect)
```

## Fora de escopo

- HLS / qualidade adaptativa (descartado na pergunta inicial).
- Captura no cliente como fallback de thumbnails (descartado).
- Pipeline em massa para vídeos antigos — só botão manual no admin.
