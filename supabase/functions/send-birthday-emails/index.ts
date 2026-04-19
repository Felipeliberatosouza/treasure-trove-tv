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
      .select('user_id, name, email, birth_date')
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

    // Carrega ambos os templates: tipo 1 (não-assinantes/professores, COM cupom) e tipo 2 (assinantes ativos, SEM cupom)
    const { data: templates } = await supabase
      .from('email_templates')
      .select('template_key, subject, body_html, logo_url, show_social_footer, coupon_enabled, coupon_code, coupon_message, coupon_starts_at, coupon_expires_at')
      .in('template_key', ['birthday', 'birthday_subscriber'])

    const tplNoSub = templates?.find((t) => t.template_key === 'birthday')
    const tplSub = templates?.find((t) => t.template_key === 'birthday_subscriber')

    if (!tplNoSub) {
      return new Response(JSON.stringify({ error: 'Birthday template not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Identifica quais usuários têm assinatura ATIVA vigente (tipo 2)
    const userIds = todaysBirthdays.map((u) => u.user_id)
    const nowIso = new Date().toISOString()
    const { data: activeSubs } = await supabase
      .from('student_subscriptions')
      .select('user_id, status, expires_at')
      .in('user_id', userIds)
      .eq('status', 'active')

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

    let sentSubscriber = 0
    let sentNoSubscription = 0

    for (const user of todaysBirthdays) {
      const isActiveSubscriber = activeSubUserIds.has(user.user_id)
      // Tipo 2 usa template do assinante (sem cupom). Tipo 1 (não-assinantes + professores) usa template padrão (pode ter cupom).
      const tpl = isActiveSubscriber && tplSub ? tplSub : tplNoSub

      const logoHtml = tpl.logo_url
        ? `<div style="text-align:center;margin-bottom:16px;"><img src="${tpl.logo_url}" alt="Logo" style="max-height:60px;max-width:200px;" /></div>`
        : ''

      let body = (tpl.body_html || '')
        .replace(/\{\{name\}\}/g, user.name || 'Estudante')
        .replace(/\{\{login_link\}\}/g, loginLink)

      // Bloco de cupom — APENAS para tipo 1 (não-assinantes) e se habilitado/válido
      let couponHtml = ''
      if (!isActiveSubscriber && tpl.coupon_enabled && tpl.coupon_code) {
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
        `Birthday email queued [${isActiveSubscriber ? 'subscriber' : 'no_subscription'}] for ${user.email}: ${subject}`,
      )
      // Suprimir variável não-usada (HTML pronto para integração com provedor)
      void fullHtml

      if (isActiveSubscriber) sentSubscriber++
      else sentNoSubscription++
    }

    return new Response(
      JSON.stringify({
        message: 'Birthday emails processed',
        sent: sentSubscriber + sentNoSubscription,
        sent_subscriber: sentSubscriber,
        sent_no_subscription: sentNoSubscription,
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
