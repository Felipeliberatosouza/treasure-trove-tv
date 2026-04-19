const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const today = new Date()
    const month = today.getMonth() + 1
    const day = today.getDate()

    const { data: birthdayUsers, error: queryError } = await supabase
      .from('profiles')
      .select('user_id, name, email, birth_date, areas')
      .not('birth_date', 'is', null)

    if (queryError) {
      console.error('Error querying profiles:', queryError)
      return new Response(JSON.stringify({ error: 'Failed to query profiles' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const todaysBirthdays = (birthdayUsers || []).filter((u) => {
      if (!u.birth_date) return false
      const bd = new Date(u.birth_date + 'T00:00:00')
      return bd.getMonth() + 1 === month && bd.getDate() === day
    })

    if (todaysBirthdays.length === 0) {
      return new Response(JSON.stringify({ message: 'No birthdays today', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Carrega os 3 templates: birthday (alunos sem assinatura), birthday_subscriber (alunos assinantes), birthday_teacher (professores)
    const { data: templates } = await supabase
      .from('email_templates')
      .select('template_key, subject, body_html, logo_url, show_social_footer, coupon_enabled, coupon_code, coupon_message, coupon_starts_at, coupon_expires_at')
      .in('template_key', ['birthday', 'birthday_subscriber', 'birthday_teacher'])

    const tplStudentNoSub = templates?.find((t) => t.template_key === 'birthday')
    const tplStudentSub = templates?.find((t) => t.template_key === 'birthday_subscriber')
    const tplTeacher = templates?.find((t) => t.template_key === 'birthday_teacher')

    if (!tplStudentNoSub) {
      return new Response(JSON.stringify({ error: 'Birthday template not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userIds = todaysBirthdays.map((u) => u.user_id)
    const nowIso = new Date().toISOString()

    // Identifica papéis (teacher) e assinaturas ativas
    const [{ data: rolesData }, { data: activeSubs }] = await Promise.all([
      supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
      supabase
        .from('student_subscriptions')
        .select('user_id, status, expires_at')
        .in('user_id', userIds)
        .eq('status', 'active'),
    ])

    const teacherUserIds = new Set(
      (rolesData || []).filter((r) => r.role === 'teacher').map((r) => r.user_id),
    )
    const activeSubUserIds = new Set(
      (activeSubs || [])
        .filter((s) => !s.expires_at || s.expires_at > nowIso)
        .map((s) => s.user_id),
    )

    // Contact + branding (footer)
    let contactData: Record<string, string> = {}
    let brandingData: Record<string, string> = {}
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['contact', 'branding'])
    if (settings) {
      for (const s of settings) {
        if (s.key === 'contact') contactData = s.value as Record<string, string>
        if (s.key === 'branding') brandingData = s.value as Record<string, string>
      }
    }

    const platformName = brandingData.platform_name || 'Revisão Fácil'
    const loginLink = supabaseUrl.replace('.supabase.co', '.lovable.app')

    const buildFooter = (showSocial: boolean) => {
      if (!showSocial) return ''
      const lines: string[] = []
      if (contactData.email) lines.push(`📧 ${contactData.email}`)
      if (contactData.phone) lines.push(`📞 ${contactData.phone}`)
      if (contactData.whatsapp) lines.push(`💬 WhatsApp: ${contactData.whatsapp}`)
      const socials: string[] = []
      if (contactData.instagram) socials.push(`<a href="https://instagram.com/${(contactData.instagram || '').replace('@', '')}" style="color:#6366f1;text-decoration:none;">Instagram</a>`)
      if (contactData.youtube) socials.push(`<a href="${contactData.youtube}" style="color:#6366f1;text-decoration:none;">YouTube</a>`)
      if (contactData.facebook) socials.push(`<a href="${contactData.facebook}" style="color:#6366f1;text-decoration:none;">Facebook</a>`)
      if (contactData.tiktok) socials.push(`<a href="https://tiktok.com/@${(contactData.tiktok || '').replace('@', '')}" style="color:#6366f1;text-decoration:none;">TikTok</a>`)
      if (contactData.linkedin) socials.push(`<a href="${contactData.linkedin}" style="color:#6366f1;text-decoration:none;">LinkedIn</a>`)
      return `
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <div style="text-align:center;font-size:12px;color:#6b7280;">
          ${lines.map((l) => `<p style="margin:4px 0;">${l}</p>`).join('')}
          ${socials.length > 0 ? `<p style="margin:8px 0;">${socials.join(' · ')}</p>` : ''}
          <p style="margin:8px 0;color:#9ca3af;">© ${new Date().getFullYear()} ${platformName}</p>
        </div>
      `
    }

    // Recomenda vídeo: mais assistido em alguma área de interesse do aluno e que ele AINDA NÃO viu.
    // Estratégia: busca lessons aprovadas+publicadas que tenham ao menos 1 área de interesse do aluno;
    // exclui as que o aluno já assistiu (video_views); rankeia por contagem total de views.
    const recommendVideoForStudent = async (
      userId: string,
      areas: string[] | null | undefined,
    ): Promise<{ id: string; title: string; thumbnail_url: string | null } | null> => {
      if (!areas || areas.length === 0) return null
      try {
        // 1) Lessons elegíveis (aprovadas, publicadas, com áreas em comum)
        const { data: candidates } = await supabase
          .from('lessons')
          .select('id, title, thumbnail_url, areas')
          .eq('published', true)
          .eq('admin_approved', true)
          .overlaps('areas', areas)

        if (!candidates || candidates.length === 0) return null

        // 2) Vídeos já assistidos pelo aluno
        const { data: viewedRows } = await supabase
          .from('video_views')
          .select('content_id')
          .eq('user_id', userId)
          .eq('content_type', 'lesson')
        const viewedIds = new Set((viewedRows || []).map((v) => v.content_id))

        const unseen = candidates.filter((c) => !viewedIds.has(c.id))
        if (unseen.length === 0) return null

        // 3) Conta views totais por lesson
        const unseenIds = unseen.map((c) => c.id)
        const { data: viewCounts } = await supabase
          .from('video_views')
          .select('content_id')
          .eq('content_type', 'lesson')
          .in('content_id', unseenIds)

        const counts = new Map<string, number>()
        for (const row of viewCounts || []) {
          counts.set(row.content_id, (counts.get(row.content_id) || 0) + 1)
        }

        // 4) Ordena por views desc, desempata por título
        unseen.sort((a, b) => {
          const ca = counts.get(a.id) || 0
          const cb = counts.get(b.id) || 0
          if (cb !== ca) return cb - ca
          return (a.title || '').localeCompare(b.title || '')
        })

        const top = unseen[0]
        return { id: top.id, title: top.title, thumbnail_url: top.thumbnail_url }
      } catch (e) {
        console.error('recommendVideoForStudent error:', e)
        return null
      }
    }

    const buildRecommendedVideoBlock = (video: { id: string; title: string; thumbnail_url: string | null } | null) => {
      if (!video) return ''
      const url = `${loginLink}/video/lesson/${video.id}`
      const thumbHtml = video.thumbnail_url
        ? `<img src="${video.thumbnail_url}" alt="${video.title}" style="width:100%;max-width:480px;border-radius:8px;display:block;margin:0 auto 12px;" />`
        : ''
      return `
        <div style="margin:24px auto;max-width:520px;padding:16px;border:1px solid #e5e7eb;border-radius:10px;background:#fafafa;text-align:center;">
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">🎁 Sugestão para você</p>
          ${thumbHtml}
          <p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#1f2937;">${video.title}</p>
          <a href="${url}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Assistir agora</a>
        </div>
      `
    }

    let sentSubscriber = 0
    let sentNoSubscription = 0
    let sentTeacher = 0

    for (const user of todaysBirthdays) {
      const isTeacher = teacherUserIds.has(user.user_id)
      const isActiveSubscriber = !isTeacher && activeSubUserIds.has(user.user_id)

      // Seleção de template:
      // - Professor → birthday_teacher (fallback: birthday)
      // - Aluno com assinatura ativa → birthday_subscriber (fallback: birthday)
      // - Demais → birthday
      let tpl = tplStudentNoSub
      if (isTeacher && tplTeacher) tpl = tplTeacher
      else if (isActiveSubscriber && tplStudentSub) tpl = tplStudentSub

      const logoHtml = tpl.logo_url
        ? `<div style="text-align:center;margin-bottom:16px;"><img src="${tpl.logo_url}" alt="Logo" style="max-height:60px;max-width:200px;" /></div>`
        : ''

      // Vídeo recomendado: APENAS para alunos (não para professores)
      let recommendedBlock = ''
      if (!isTeacher) {
        const video = await recommendVideoForStudent(user.user_id, user.areas as string[] | null)
        recommendedBlock = buildRecommendedVideoBlock(video)
      }

      let body = (tpl.body_html || '')
        .replace(/\{\{name\}\}/g, user.name || (isTeacher ? 'Professor(a)' : 'Estudante'))
        .replace(/\{\{login_link\}\}/g, loginLink)
        .replace(/\{\{recommended_video_block\}\}/g, recommendedBlock)

      // Cupom — APENAS para alunos sem assinatura ativa (template 'birthday') e se habilitado/válido.
      // Professores e assinantes ativos NÃO recebem cupom.
      let couponHtml = ''
      const canIncludeCoupon = !isTeacher && !isActiveSubscriber && tpl.template_key === 'birthday'
      if (canIncludeCoupon && tpl.coupon_enabled && tpl.coupon_code) {
        const now = Date.now()
        const startOk = !tpl.coupon_starts_at || new Date(tpl.coupon_starts_at).getTime() <= now
        const endOk = !tpl.coupon_expires_at || new Date(tpl.coupon_expires_at).getTime() >= now
        if (startOk && endOk) {
          couponHtml = `
            <div style="margin:24px auto;max-width:420px;padding:16px;border:2px dashed #4f46e5;border-radius:10px;text-align:center;background:#f5f3ff;">
              ${tpl.coupon_message ? `<p style="margin:0 0 8px;color:#4f46e5;font-weight:600;">${tpl.coupon_message}</p>` : ''}
              <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:2px;color:#1e1b4b;">${tpl.coupon_code}</p>
            </div>
          `
        }
      }

      const fullHtml = `
        <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#ffffff;padding:24px;border-radius:8px;">
          ${logoHtml}
          ${body}
          ${couponHtml}
          ${buildFooter(tpl.show_social_footer)}
        </div>
      `

      const subject = (tpl.subject || '').replace(/\{\{name\}\}/g, user.name || 'Estudante')

      console.log(
        `Birthday email queued [${isTeacher ? 'teacher' : isActiveSubscriber ? 'subscriber' : 'no_subscription'}] for ${user.email}: ${subject}`,
      )
      void fullHtml

      // Log de auditoria
      try {
        await supabase.from('birthday_email_log').insert({
          user_id: user.user_id,
          recipient_email: user.email,
          recipient_name: user.name || null,
          template_key: tpl.template_key,
          is_active_subscriber: isActiveSubscriber,
          coupon_included: couponHtml.length > 0,
          coupon_code: couponHtml.length > 0 ? tpl.coupon_code : null,
          metadata: {
            subject,
            is_teacher: isTeacher,
            recommended_video_included: recommendedBlock.length > 0,
          },
        })
      } catch (logErr) {
        console.error('Failed to log birthday email:', logErr)
      }

      if (isTeacher) sentTeacher++
      else if (isActiveSubscriber) sentSubscriber++
      else sentNoSubscription++
    }

    return new Response(
      JSON.stringify({
        message: 'Birthday emails processed',
        sent: sentSubscriber + sentNoSubscription + sentTeacher,
        sent_subscriber: sentSubscriber,
        sent_no_subscription: sentNoSubscription,
        sent_teacher: sentTeacher,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('Birthday cron error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
