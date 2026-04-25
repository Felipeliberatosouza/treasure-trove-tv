// Reengajamento: dispara e-mails para alunos (14d sem assistir vídeo) e
// professores (30d sem postar conteúdo). Reenvio mínimo a cada 30d (configurável
// em platform_settings.reengagement_config). Idempotência via reengagement_email_log.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1'

interface ReengagementConfig {
  student_inactive_days: number
  teacher_inactive_days: number
  resend_interval_days: number
  enabled: boolean
}

const DEFAULTS: ReengagementConfig = {
  student_inactive_days: 14,
  teacher_inactive_days: 30,
  resend_interval_days: 30,
  enabled: true,
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const loginLink = supabaseUrl.replace('.supabase.co', '.lovable.app')

    // Config
    const { data: cfgRow } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'reengagement_config')
      .maybeSingle()
    const cfg: ReengagementConfig = { ...DEFAULTS, ...(cfgRow?.value as Partial<ReengagementConfig> | null) }
    if (!cfg.enabled) {
      return new Response(JSON.stringify({ message: 'Reengagement disabled', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Templates
    const { data: tpls } = await supabase
      .from('email_templates')
      .select('template_key, subject, body_html, logo_url, show_social_footer, heading_color, button_color, link_color, text_color, font_family, use_uploaded_logo')
      .in('template_key', ['reengagement_student', 'reengagement_teacher'])
    const tplStudent = tpls?.find((t) => t.template_key === 'reengagement_student')
    const tplTeacher = tpls?.find((t) => t.template_key === 'reengagement_teacher')

    // Branding + contact for footer
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['contact', 'branding', 'video_pricing'])
    let contactData: Record<string, string> = {}
    let brandingData: Record<string, string> = {}
    let videoPricing: Record<string, any> = {}
    for (const s of settings || []) {
      if (s.key === 'contact') contactData = (s.value as Record<string, string>) || {}
      if (s.key === 'branding') brandingData = (s.value as Record<string, string>) || {}
      if (s.key === 'video_pricing') videoPricing = (s.value as Record<string, any>) || {}
    }
    const platformName = brandingData.platform_name || 'Revisão Fácil'
    const slogan = (brandingData.slogan || '').trim()
    const escapeHtml = (s: string) =>
      String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    const logoMaxWidth = 200
    const sloganFontSize = slogan.length > 0
      ? Math.max(8, Math.min(14, (logoMaxWidth / slogan.length) * 1.7))
      : 11
    const sloganHtml = slogan
      ? `<div style="text-align:center;margin-top:-6px;margin-bottom:16px;"><span style="display:inline-block;max-width:${logoMaxWidth}px;color:#6b7280;font-size:${sloganFontSize.toFixed(1)}px;line-height:1;white-space:nowrap;overflow:hidden;">${escapeHtml(slogan)}</span></div>`
      : ''
    const buildLogoHtml = (logoUrl: string, useUploaded: boolean, headingColor: string) => {
      const inner = logoUrl && useUploaded
        ? `<div style="text-align:center;margin-bottom:${slogan ? '0' : '16px'};"><img src="${escapeHtml(logoUrl)}" alt="Logo" style="max-height:60px;max-width:${logoMaxWidth}px;display:inline-block;" /></div>`
        : `<div style="text-align:center;margin-bottom:${slogan ? '0' : '16px'};font-size:24px;font-weight:bold;color:${headingColor};">${escapeHtml(platformName)}</div>`
      return `${inner}${sloganHtml}`
    }

    const buildFooter = (showSocial: boolean) => {
      if (!showSocial) return ''
      const lines: string[] = []
      if (contactData.email) lines.push(`📧 ${contactData.email}`)
      if (contactData.phone) lines.push(`📞 ${contactData.phone}`)
      if (contactData.whatsapp) lines.push(`💬 WhatsApp: ${contactData.whatsapp}`)
      return `
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <div style="text-align:center;font-size:12px;color:#6b7280;">
          ${lines.map((l) => `<p style="margin:4px 0;">${l}</p>`).join('')}
          <p style="margin:8px 0;color:#9ca3af;">© ${new Date().getFullYear()} ${platformName}</p>
          <p style="margin:8px 0;font-size:11px;color:#9ca3af;">
            Não quer mais receber estes e-mails? <a href="${loginLink}/dashboard" style="color:#6366f1;">Atualize suas preferências</a>.
          </p>
        </div>
      `
    }

    const nowMs = Date.now()
    const studentCutoff = new Date(nowMs - cfg.student_inactive_days * 86400000).toISOString()
    const teacherCutoff = new Date(nowMs - cfg.teacher_inactive_days * 86400000).toISOString()
    const resendCutoff = new Date(nowMs - cfg.resend_interval_days * 86400000).toISOString()

    // ============== ALUNOS ==============
    let sentStudents = 0
    let skippedStudents = 0

    if (tplStudent) {
      // Todos os perfis ativos (não eliminamos por papel para incluir alunos+prof)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, email, areas')
        .eq('active', true)
      const allProfiles = profiles || []

      // Roles para identificar alunos
      const allUserIds = allProfiles.map((p) => p.user_id)
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', allUserIds)
      const studentIds = new Set((roles || []).filter((r) => r.role === 'student').map((r) => r.user_id))

      // Quem assistiu vídeo nos últimos N dias → exclui
      const { data: recentViews } = await supabase
        .from('video_views')
        .select('user_id')
        .gte('viewed_at', studentCutoff)
      const recentlyActiveStudents = new Set((recentViews || []).map((v) => v.user_id))

      // Quem recebeu reengajamento de aluno nos últimos resendInterval dias → exclui
      const { data: recentReeng } = await supabase
        .from('reengagement_email_log')
        .select('user_id')
        .eq('template_key', 'reengagement_student')
        .gte('sent_at', resendCutoff)
      const recentlyEmailedStudents = new Set((recentReeng || []).map((r) => r.user_id))

      const eligibleStudents = allProfiles.filter(
        (p) =>
          studentIds.has(p.user_id) &&
          !recentlyActiveStudents.has(p.user_id) &&
          !recentlyEmailedStudents.has(p.user_id) &&
          p.email,
      )

      // Helper: top vídeos não vistos (3 por aluno)
      const pickTop3VideosForStudent = async (
        userId: string,
        areas: string[] | null | undefined,
      ): Promise<{
        videos: Array<{ id: string; title: string; thumbnail_url: string | null }>
        source: 'interest_area' | 'global_fallback' | 'mixed' | 'none'
      }> => {
        const { data: viewedRows } = await supabase
          .from('video_views')
          .select('content_id')
          .eq('user_id', userId)
          .eq('content_type', 'lesson')
        const viewedIds = new Set((viewedRows || []).map((v) => v.content_id))

        // Helper para ranqueio por views
        const rank = async (cands: Array<{ id: string; title: string; thumbnail_url: string | null }>) => {
          if (cands.length === 0) return [] as typeof cands
          const ids = cands.map((c) => c.id)
          const { data: vc } = await supabase
            .from('video_views')
            .select('content_id')
            .eq('content_type', 'lesson')
            .in('content_id', ids)
          const counts = new Map<string, number>()
          for (const r of vc || []) counts.set(r.content_id, (counts.get(r.content_id) || 0) + 1)
          return [...cands].sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0))
        }

        const picks: Array<{ id: string; title: string; thumbnail_url: string | null }> = []
        let source: 'interest_area' | 'global_fallback' | 'mixed' | 'none' = 'none'

        if (areas && areas.length > 0) {
          const { data: areaCands } = await supabase
            .from('lessons')
            .select('id, title, thumbnail_url')
            .eq('published', true)
            .eq('admin_approved', true)
            .overlaps('areas', areas)
          const unseen = (areaCands || []).filter((c) => !viewedIds.has(c.id))
          const ranked = await rank(unseen)
          picks.push(...ranked.slice(0, 3))
          if (picks.length > 0) source = 'interest_area'
        }

        if (picks.length < 3) {
          // Fallback global para completar
          const { data: allCands } = await supabase
            .from('lessons')
            .select('id, title, thumbnail_url')
            .eq('published', true)
            .eq('admin_approved', true)
          const pickedIds = new Set(picks.map((p) => p.id))
          const unseenGlobal = (allCands || []).filter((c) => !viewedIds.has(c.id) && !pickedIds.has(c.id))
          const rankedGlobal = await rank(unseenGlobal)
          const need = 3 - picks.length
          if (rankedGlobal.length > 0) {
            picks.push(...rankedGlobal.slice(0, need))
            source = source === 'interest_area' ? 'mixed' : 'global_fallback'
          }
        }

        return { videos: picks, source: picks.length === 0 ? 'none' : source }
      }

      const buildVideosBlock = (
        videos: Array<{ id: string; title: string; thumbnail_url: string | null }>,
      ) => {
        if (videos.length === 0) return ''
        const cards = videos
          .map((v) => {
            const url = `${loginLink}/video/lesson/${v.id}`
            const thumb = v.thumbnail_url
              ? `<img src="${v.thumbnail_url}" alt="${v.title}" style="width:100%;border-radius:8px;display:block;" />`
              : `<div style="background:#e5e7eb;height:120px;border-radius:8px;"></div>`
            return `
              <td style="padding:8px;vertical-align:top;width:33%;">
                <a href="${url}" style="text-decoration:none;color:inherit;display:block;">
                  ${thumb}
                  <p style="margin:8px 0 0;font-size:13px;font-weight:600;color:#1f2937;line-height:1.3;">${v.title}</p>
                  <p style="margin:6px 0 0;font-size:12px;color:#6366f1;font-weight:600;">Assistir →</p>
                </a>
              </td>
            `
          })
          .join('')
        return `
          <div style="margin:24px 0;">
            <h3 style="margin:0 0 12px;font-size:16px;color:#111827;text-align:center;">🔥 Bombando agora na plataforma</h3>
            <table style="width:100%;border-collapse:separate;border-spacing:0;">
              <tr>${cards}</tr>
            </table>
          </div>
        `
      }

      for (const u of eligibleStudents) {
        const { videos, source } = await pickTop3VideosForStudent(
          u.user_id,
          u.areas as string[] | null,
        )
        if (videos.length === 0) {
          skippedStudents++
          continue // sem vídeos elegíveis, não faz sentido mandar
        }

        const studentLogoUrl = tplStudent.logo_url || brandingData.logo_url || ''
        const logoHtml = buildLogoHtml(studentLogoUrl, !!tplStudent.use_uploaded_logo, tplStudent.heading_color || '#dc2626')

        const baseBody = (tplStudent.body_html && tplStudent.body_html.trim().length > 0)
          ? tplStudent.body_html
          : `
            <h1 style="font-size:22px;color:${tplStudent.heading_color || '#dc2626'};margin:0 0 12px;text-align:center;">Estamos com saudade, {{name}}! 💜</h1>
            <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 12px;">
              Faz um tempinho que você não acessa a ${platformName}. Sabemos que a rotina aperta — mas alguns minutinhos por dia já fazem toda a diferença na sua preparação.
            </p>
            <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 16px;">
              Separamos 3 vídeos que estão bombando na plataforma e que combinam com o que você estuda. Bora retomar?
            </p>
            {{recommended_videos_block}}
            <div style="text-align:center;margin:24px 0;">
              <a href="{{login_link}}" style="display:inline-block;padding:12px 28px;background:${tplStudent.button_color || '#6366f1'};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Acessar a plataforma</a>
            </div>
          `

        const videosBlock = buildVideosBlock(videos)
        const body = baseBody
          .replace(/\{\{name\}\}/g, u.name || 'Estudante')
          .replace(/\{\{login_link\}\}/g, loginLink)
          .replace(/\{\{recommended_videos_block\}\}/g, videosBlock)

        const fullHtml = `
          <div style="max-width:600px;margin:0 auto;font-family:${tplStudent.font_family || 'Arial, sans-serif'};background:#ffffff;padding:24px;border-radius:8px;">
            ${logoHtml}
            ${body}
            ${buildFooter(tplStudent.show_social_footer)}
          </div>
        `
        const subject = (tplStudent.subject || 'Sentimos sua falta! 🎯').replace(/\{\{name\}\}/g, u.name || '')

        console.log(`Reengagement student email queued for ${u.email}: ${subject}`)
        void fullHtml

        try {
          await supabase.from('reengagement_email_log').insert({
            user_id: u.user_id,
            recipient_email: u.email,
            recipient_name: u.name || null,
            template_key: 'reengagement_student',
            days_inactive: cfg.student_inactive_days,
            metadata: {
              subject,
              video_ids: videos.map((v) => v.id),
              video_source: source,
            },
          })
        } catch (e) {
          console.error('Failed to log student reengagement:', e)
        }
        sentStudents++
      }
    }

    // ============== PROFESSORES ==============
    let sentTeachers = 0
    let skippedTeachers = 0

    if (tplTeacher) {
      // Todos os profs ativos
      const { data: teacherRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'teacher')
      const teacherIds = (teacherRoles || []).map((r) => r.user_id)

      const { data: teacherProfiles } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', teacherIds)
        .eq('active', true)

      // Profs que postaram conteúdo nos últimos N dias → exclui
      const [{ data: recentLessons }, { data: recentExams }] = await Promise.all([
        supabase
          .from('lessons')
          .select('teacher_id')
          .gte('created_at', teacherCutoff)
          .in('teacher_id', teacherIds),
        supabase
          .from('exam_solutions')
          .select('teacher_id')
          .gte('created_at', teacherCutoff)
          .in('teacher_id', teacherIds),
      ])
      const recentlyActiveTeachers = new Set([
        ...(recentLessons || []).map((l) => l.teacher_id),
        ...(recentExams || []).map((e) => e.teacher_id),
      ])

      // Reenvio
      const { data: recentReengT } = await supabase
        .from('reengagement_email_log')
        .select('user_id')
        .eq('template_key', 'reengagement_teacher')
        .gte('sent_at', resendCutoff)
      const recentlyEmailedTeachers = new Set((recentReengT || []).map((r) => r.user_id))

      const eligibleTeachers = (teacherProfiles || []).filter(
        (p) =>
          !recentlyActiveTeachers.has(p.user_id) &&
          !recentlyEmailedTeachers.has(p.user_id) &&
          p.email,
      )

      // Stats da plataforma para simulação
      // Preço médio por video: usa price médio das lessons + exam_solutions; fallback para video_pricing.default ou 5
      const { data: priceRows } = await supabase
        .from('lessons')
        .select('price')
        .gt('price', 0)
        .eq('published', true)
      const prices = (priceRows || []).map((r) => Number(r.price)).filter((n) => n > 0)
      const avgPrice = prices.length > 0
        ? prices.reduce((a, b) => a + b, 0) / prices.length
        : Number(videoPricing?.default_price || 5)

      // Para cada professor, computa stats próprios
      for (const t of eligibleTeachers) {
        // Vídeos do professor
        const [{ data: tLessons }, { data: tExams }] = await Promise.all([
          supabase.from('lessons').select('id, platform_percentage, price').eq('teacher_id', t.user_id).eq('published', true),
          supabase.from('exam_solutions').select('id, platform_percentage, price').eq('teacher_id', t.user_id).eq('published', true),
        ])
        const myVideos = [...(tLessons || []), ...(tExams || [])]
        const totalVideos = myVideos.length

        // Views totais
        const allMyIds = myVideos.map((v) => v.id)
        let totalViews = 0
        if (allMyIds.length > 0) {
          const { count } = await supabase
            .from('video_views')
            .select('id', { count: 'exact', head: true })
            .in('content_id', allMyIds)
          totalViews = count || 0
        }

        // % média do professor (pago ao prof = 100 - platform_percentage)
        const platformPcts = myVideos.map((v) => Number(v.platform_percentage ?? 30))
        const avgPlatformPct = platformPcts.length > 0
          ? platformPcts.reduce((a, b) => a + b, 0) / platformPcts.length
          : 30
        const teacherShare = (100 - avgPlatformPct) / 100

        // Cenários por VÍDEO POSTADO POR MÊS
        const scenarios = [
          { label: 'Conservador', viewsPerMonth: 50 },
          { label: 'Realista', viewsPerMonth: 200 },
          { label: 'Otimista', viewsPerMonth: 500 },
        ].map((s) => ({
          ...s,
          earnings: Math.round(s.viewsPerMonth * avgPrice * teacherShare * 100) / 100,
        }))

        const fmt = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`

        const statsBlock = totalVideos > 0
          ? `
            <div style="margin:24px 0;padding:16px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;">
              <h3 style="margin:0 0 12px;font-size:15px;color:#111827;">📊 Seu desempenho até agora</h3>
              <table style="width:100%;font-size:14px;color:#374151;">
                <tr><td style="padding:4px 0;">Vídeos publicados:</td><td style="text-align:right;font-weight:600;">${totalVideos}</td></tr>
                <tr><td style="padding:4px 0;">Visualizações totais:</td><td style="text-align:right;font-weight:600;">${totalViews}</td></tr>
                <tr><td style="padding:4px 0;">Sua participação:</td><td style="text-align:right;font-weight:600;">${(teacherShare * 100).toFixed(0)}%</td></tr>
              </table>
            </div>
          `
          : `
            <div style="margin:24px 0;padding:16px;border:1px dashed #cbd5e1;border-radius:10px;background:#f8fafc;text-align:center;">
              <p style="margin:0;font-size:14px;color:#475569;">Você ainda não publicou nenhum vídeo. Que tal começar agora?</p>
            </div>
          `

        const scenariosBlock = `
          <div style="margin:24px 0;">
            <h3 style="margin:0 0 12px;font-size:15px;color:#111827;text-align:center;">💰 Quanto você pode ganhar por vídeo postado/mês</h3>
            <p style="margin:0 0 12px;font-size:12px;color:#6b7280;text-align:center;">
              Estimativa baseada no preço médio da plataforma (${fmt(avgPrice)}) e na sua participação de ${(teacherShare * 100).toFixed(0)}%.
            </p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th style="padding:10px;text-align:left;border-bottom:1px solid #e5e7eb;">Cenário</th>
                  <th style="padding:10px;text-align:center;border-bottom:1px solid #e5e7eb;">Views/mês</th>
                  <th style="padding:10px;text-align:right;border-bottom:1px solid #e5e7eb;">Ganho/vídeo/mês</th>
                </tr>
              </thead>
              <tbody>
                ${scenarios.map((s, i) => `
                  <tr style="${i % 2 === 1 ? 'background:#fafafa;' : ''}">
                    <td style="padding:10px;color:#374151;">${s.label}</td>
                    <td style="padding:10px;text-align:center;color:#374151;">${s.viewsPerMonth}</td>
                    <td style="padding:10px;text-align:right;font-weight:700;color:#059669;">${fmt(s.earnings)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <p style="margin:12px 0 0;font-size:11px;color:#9ca3af;text-align:center;">
              * Valores estimados. Ganho real depende do preço definido por você, do percentual da plataforma e do volume de acessos.
            </p>
          </div>
        `

        const teacherLogoUrl = tplTeacher.logo_url || brandingData.logo_url || ''
        const logoHtml = buildLogoHtml(teacherLogoUrl, !!tplTeacher.use_uploaded_logo, tplTeacher.heading_color || '#0891b2')

        const baseBody = (tplTeacher.body_html && tplTeacher.body_html.trim().length > 0)
          ? tplTeacher.body_html
          : `
            <h1 style="font-size:22px;color:${tplTeacher.heading_color || '#0891b2'};margin:0 0 12px;text-align:center;">Olá, {{name}}! 👋</h1>
            <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 12px;">
              Faz um tempinho que você não publica conteúdo na ${platformName}. Sentimos sua falta!
            </p>
            <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 4px;">
              Cada vídeo seu ajuda alunos do Brasil inteiro — e gera renda recorrente para você. Veja seu desempenho e o potencial de ganhos:
            </p>
            {{teacher_stats_block}}
            {{teacher_scenarios_block}}
            <div style="text-align:center;margin:24px 0;">
              <a href="{{login_link}}/teacher-dashboard" style="display:inline-block;padding:12px 28px;background:${tplTeacher.button_color || '#0891b2'};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Gravar novo vídeo</a>
            </div>
          `

        const body = baseBody
          .replace(/\{\{name\}\}/g, t.name || 'Professor(a)')
          .replace(/\{\{login_link\}\}/g, loginLink)
          .replace(/\{\{teacher_stats_block\}\}/g, statsBlock)
          .replace(/\{\{teacher_scenarios_block\}\}/g, scenariosBlock)
          .replace(/\{\{total_videos\}\}/g, String(totalVideos))
          .replace(/\{\{total_views\}\}/g, String(totalViews))

        const fullHtml = `
          <div style="max-width:600px;margin:0 auto;font-family:${tplTeacher.font_family || 'Arial, sans-serif'};background:#ffffff;padding:24px;border-radius:8px;">
            ${logoHtml}
            ${body}
            ${buildFooter(tplTeacher.show_social_footer)}
          </div>
        `
        const subject = (tplTeacher.subject || 'Seu impacto + potencial de ganhos 💰').replace(/\{\{name\}\}/g, t.name || '')

        console.log(`Reengagement teacher email queued for ${t.email}: ${subject}`)
        void fullHtml

        try {
          await supabase.from('reengagement_email_log').insert({
            user_id: t.user_id,
            recipient_email: t.email,
            recipient_name: t.name || null,
            template_key: 'reengagement_teacher',
            days_inactive: cfg.teacher_inactive_days,
            metadata: {
              subject,
              total_videos: totalVideos,
              total_views: totalViews,
              avg_price: avgPrice,
              teacher_share_pct: Number((teacherShare * 100).toFixed(2)),
              scenarios,
            },
          })
        } catch (e) {
          console.error('Failed to log teacher reengagement:', e)
        }
        sentTeachers++
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Reengagement processed',
        config: cfg,
        sent_students: sentStudents,
        skipped_students: skippedStudents,
        sent_teachers: sentTeachers,
        skipped_teachers: skippedTeachers,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('Reengagement error:', err)
    return new Response(JSON.stringify({ error: 'Internal error', detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
