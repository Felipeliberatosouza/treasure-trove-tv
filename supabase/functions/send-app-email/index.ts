import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { EmailAPIError, sendLovableEmail } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'
import { buildEmailLogoHtml, escapeHtml, resolveEmailLogoUrl } from '../_shared/email-logo.ts'

// Sends application e-mails through Lovable's managed email API.
// Delivery, retries, suppression and unsubscribe are handled by Lovable.
const SITE_NAME = "Revisão Fácil"
// SENDER_DOMAIN is the verified sender subdomain FQDN.
const SENDER_DOMAIN = "notify.revisaofacil.com.br"
// FROM_DOMAIN is the domain shown in the From: header.
const FROM_DOMAIN = "revisaofacil.com.br"

// Maps registry template names (kebab-case used in code) to the
// `template_key` column used in the `email_templates` admin table.
const TEMPLATE_KEY_ALIAS: Record<string, string> = {
  'welcome-student': 'welcome',
  'welcome-teacher': 'welcome',
  'new-student-admin-notify': 'new_student_admin',
  'new-teacher-admin-notify': 'new_teacher_admin',
  'password-recovery': 'password_recovery',
  'content-approved': 'content_approved',
  'content-rejected': 'content_rejected',
  'contract-signed': 'contract_signed',
  'doubt-answered': 'doubt_answered',
  'doubt-approved': 'doubt_approved',
  'doubt-question-approved': 'doubt_question_approved',
  'doubt-sent-confirmation': 'doubt_submitted',
  'payment-confirmation': 'payment_confirmation',
  'subscription-cancelled': 'subscription_cancelled',
  'password-changed-admin': 'password_changed_admin',
  'cashback-referral-share': 'cashback_referral_share',
  'referral-access-invite': 'referral_access_invite',
}

function resolveAdminTemplateKey(name: string): string {
  return TEMPLATE_KEY_ALIAS[name] || name
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const apiKey = Deno.env.get('LOVABLE_API_KEY')

  if (!supabaseUrl || !supabaseServiceKey || !apiKey) {
    console.error('Missing required environment variables')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Verify the caller. Service-role calls bypass JWT verification; otherwise
  // validate the user's JWT via getClaims and infer the role from the claims.
  const token = authHeader.replace('Bearer ', '')
  let callerRole = 'anon'
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const publishableKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || ''
  if (token === supabaseServiceKey) {
    callerRole = 'service_role'
  } else if (token && (token === anonKey || token === publishableKey)) {
    callerRole = 'anon'
  } else {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      callerRole = 'anon'
    } else {
      callerRole = (claimsData.claims as any)?.role || 'anon'
    }
  }

  const PUBLIC_ANON_TEMPLATES = new Set<string>([
    'contact-message',
    'suspicious-login-admin-notify',
    'password_recovery',
    'welcome-student',
    'welcome-teacher',
    'new-student-admin-notify',
    'new-teacher-admin-notify',
    'payment-confirmation',
    'doubt-sent-confirmation',
  ])

  let templateName: string
  let recipientEmail: string
  let idempotencyKey: string
  let messageId: string
  let templateData: Record<string, any> = {}
  try {
    const body = await req.json()
    templateName = body.templateName || body.template_name
    recipientEmail = body.recipientEmail || body.recipient_email
    messageId = crypto.randomUUID()
    idempotencyKey = body.idempotencyKey || body.idempotency_key || messageId
    if (body.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!templateName) {
    return new Response(JSON.stringify({ error: 'templateName is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (callerRole === 'anon' && !PUBLIC_ANON_TEMPLATES.has(templateName)) {
    return new Response(
      JSON.stringify({ error: 'Forbidden: template not available for anonymous callers' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const template = TEMPLATES[templateName]
  if (!template) {
    console.error('Template not found in registry', { templateName })
    return new Response(
      JSON.stringify({
        error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`,
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const effectiveRecipient = template.to || recipientEmail
  if (!effectiveRecipient) {
    return new Response(
      JSON.stringify({
        error: 'recipientEmail is required (unless the template defines a fixed recipient)',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Dedupe: certain templates must be sent at most once per recipient.
  const ONCE_PER_RECIPIENT = new Set<string>(['welcome-student', 'welcome-teacher'])
  if (ONCE_PER_RECIPIENT.has(templateName)) {
    const { data: priorSend } = await supabase
      .from('email_send_log')
      .select('id')
      .eq('template_name', templateName)
      .eq('recipient_email', effectiveRecipient)
      .neq('status', 'failed')
      .limit(1)
      .maybeSingle()
    if (priorSend) {
      return new Response(
        JSON.stringify({ success: false, reason: 'already_sent' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  const normalizedEmail = effectiveRecipient.toLowerCase()
  const enrichedTemplateData = { ...templateData }

  // 1. Render React Email template to HTML and plain text
  let html = await renderAsync(
    React.createElement(template.component, enrichedTemplateData)
  )
  let plainText = await renderAsync(
    React.createElement(template.component, enrichedTemplateData),
    { plainText: true }
  )

  // 1.1 Optional discount-coupon banner — admin-configured per template_key
  try {
    const { data: tplCfg } = await supabase
      .from('email_templates')
      .select('coupon_enabled, coupon_code, coupon_message, coupon_expires_at, coupon_starts_at')
      .eq('template_key', resolveAdminTemplateKey(templateName))
      .maybeSingle()

    const nowMs = Date.now()
    const couponExpired = tplCfg?.coupon_expires_at
      ? new Date(tplCfg.coupon_expires_at as string).getTime() < nowMs
      : false
    const couponNotStarted = (tplCfg as any)?.coupon_starts_at
      ? new Date((tplCfg as any).coupon_starts_at as string).getTime() > nowMs
      : false

    if (
      tplCfg?.coupon_enabled &&
      !couponExpired &&
      !couponNotStarted &&
      (tplCfg.coupon_code || tplCfg.coupon_message)
    ) {
      const safe = (s: string) =>
        String(s ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
      const code = safe(tplCfg.coupon_code || '')
      const message = safe(tplCfg.coupon_message || '')
      const couponHtml = `
        <div style="margin:24px auto;max-width:560px;background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border:2px dashed #d97706;border-radius:12px;padding:20px 24px;text-align:center;font-family:Arial,sans-serif;">
          ${message ? `<p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#7c2d12;line-height:1.4;">${message}</p>` : ''}
          ${code ? `<div style="display:inline-block;background:#ffffff;border:2px solid #d97706;border-radius:8px;padding:12px 24px;font-size:22px;font-weight:800;letter-spacing:2px;color:#7c2d12;font-family:'Courier New',monospace;">${code}</div>` : ''}
          <p style="margin:12px 0 0;font-size:12px;color:#92400e;">Use este cupom em sua próxima assinatura</p>
        </div>
      `
      const plainCoupon = `\n\n${tplCfg.coupon_message || ''}${tplCfg.coupon_code ? `\nCupom: ${tplCfg.coupon_code}` : ''}\n\n`

      if (html.includes('</body>')) {
        html = html.replace('</body>', `${couponHtml}</body>`)
      } else {
        html = `${html}${couponHtml}`
      }
      plainText = `${plainText}${plainCoupon}`
    }
  } catch (e) {
    console.error('Coupon injection failed (non-fatal)', e)
  }

  const resolvedSubject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  // 2. Override rendered HTML/subject/sender with the admin-configured template
  // (email_templates table), matching the admin preview.
  let fromHeader = `${SITE_NAME} <noreply@${FROM_DOMAIN}>`
  let finalSubject = resolvedSubject
  let platformName = SITE_NAME
  try {
    const { data: brandingRow } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'branding')
      .maybeSingle()
    const brandingVal = (brandingRow?.value as any) || {}
    if (brandingVal.platform_name) platformName = String(brandingVal.platform_name)

    const { data: contactRow } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'contact')
      .maybeSingle()
    const contactVal = (contactRow?.value as any) || {}

    const { data: tplCfg2 } = await supabase
      .from('email_templates')
      .select(
        'from_email, from_name, subject, body_html, logo_url, logo_variant, use_uploaded_logo, text_color, heading_color, link_color, button_color, button_text_color, slogan_color, font_family, show_social_footer, always_send'
      )
      .eq('template_key', resolveAdminTemplateKey(templateName))
      .maybeSingle()

    const customEmail = (tplCfg2?.from_email || '').trim()
    const customName = (tplCfg2?.from_name || '').trim()
    const senderName = customName || platformName
    if (customEmail) {
      fromHeader = `${senderName} <${customEmail}>`
    } else {
      fromHeader = `${senderName} <noreply@${FROM_DOMAIN}>`
    }

    const mergedData = { platform_name: platformName, ...enrichedTemplateData }
    const renderPlaceholders = (s: string) =>
      s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k) => {
        const v = (mergedData as any)?.[k]
        return v === undefined || v === null ? '' : String(v)
      })
    const customSubject = (tplCfg2?.subject || '').trim()
    if (customSubject) {
      finalSubject = renderPlaceholders(customSubject)
    }

    if (tplCfg2?.body_html && tplCfg2.body_html.trim().length > 0) {
      const textColor = tplCfg2.text_color || '#333333'
      const headingColor = tplCfg2.heading_color || '#dc2626'
      const linkColor = tplCfg2.link_color || '#6366f1'
      const buttonColor = tplCfg2.button_color || '#6366f1'
      const buttonTextColor = tplCfg2.button_text_color || '#ffffff'
      const sloganColor = tplCfg2.slogan_color || '#6b7280'
      const fontFamily = tplCfg2.font_family || 'Arial, sans-serif'
      const effectiveLogoUrl = resolveEmailLogoUrl(tplCfg2 as any, brandingVal as any)

      const logoHtml = buildEmailLogoHtml({
        logoUrl: effectiveLogoUrl,
        useUploadedLogo: tplCfg2.use_uploaded_logo !== false,
        platformName,
        slogan: brandingVal.slogan,
        headingColor,
        sloganColor,
      })

      let body = renderPlaceholders(tplCfg2.body_html)
      body = body.replace(/<h([1-3])([^>]*)>/gi, (match, level, attrs) => {
        if (/style=/.test(attrs)) {
          return match.replace(/color:[^;"']*/i, `color:${headingColor}`)
        }
        return `<h${level}${attrs} style="color:${headingColor};">`
      })
      body = body.replace(/background-color:\s*#[0-9a-fA-F]{3,6}/gi, `background-color:${buttonColor}`)
      body = body.replace(/background:\s*#[0-9a-fA-F]{3,6}/gi, `background:${buttonColor}`)
      body = body.replace(
        /(<a\b[^>]*style="[^"]*background(?:-color)?:\s*[^;"]*;[^"]*)(color:\s*#[0-9a-fA-F]{3,6})/gi,
        (_m, pre) => `${pre}color:${buttonTextColor}`
      )

      let footerHtml = ''
      if (tplCfg2.show_social_footer) {
        const lines: string[] = []
        if (contactVal.email) lines.push(`📧 ${escapeHtml(contactVal.email)}`)
        if (contactVal.phone) lines.push(`📞 ${escapeHtml(contactVal.phone)}`)
        if (contactVal.whatsapp) lines.push(`💬 WhatsApp: ${escapeHtml(contactVal.whatsapp)}`)
        const socials: string[] = []
        const linkStyle = `color:${linkColor};text-decoration:none;`
        if (contactVal.instagram) socials.push(`<a href="https://instagram.com/${escapeHtml(String(contactVal.instagram).replace('@',''))}" style="${linkStyle}">Instagram</a>`)
        if (contactVal.youtube) socials.push(`<a href="${escapeHtml(contactVal.youtube)}" style="${linkStyle}">YouTube</a>`)
        if (contactVal.facebook) socials.push(`<a href="${escapeHtml(contactVal.facebook)}" style="${linkStyle}">Facebook</a>`)
        if (contactVal.tiktok) socials.push(`<a href="https://tiktok.com/@${escapeHtml(String(contactVal.tiktok).replace('@',''))}" style="${linkStyle}">TikTok</a>`)
        footerHtml = `
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <div style="text-align:center;font-size:12px;color:#6b7280;">
            ${lines.map((l) => `<p style="margin:4px 0;">${l}</p>`).join('')}
            ${socials.length ? `<p style="margin:8px 0;">${socials.join(' · ')}</p>` : ''}
            <p style="margin:8px 0;color:#9ca3af;">© ${new Date().getFullYear()} ${escapeHtml(platformName)}</p>
          </div>`
      }

      const innerHtml = `
        <div style="max-width:600px;margin:0 auto;font-family:${fontFamily};background:#ffffff;padding:24px;border-radius:8px;color:${textColor};">
          ${logoHtml}
          ${body}
          ${footerHtml}
        </div>`

      html = `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(finalSubject)}</title></head><body style="margin:0;background:#f3f4f6;padding:16px 0;">${innerHtml}</body></html>`
      plainText = body
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<br\s*\/?>(\s*)/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    }
  } catch (e) {
    console.error('DB template render failed (fallback to React template)', e)
  }

  // 3. Send through Lovable's managed email API.
  try {
    await sendLovableEmail(
      {
        to: effectiveRecipient,
        from: fromHeader,
        sender_domain: SENDER_DOMAIN,
        subject: finalSubject,
        html,
        text: plainText,
        purpose: 'transactional',
        label: templateName,
        idempotency_key: idempotencyKey,
      },
      { apiKey, sendUrl: Deno.env.get('LOVABLE_SEND_URL') }
    )
  } catch (error) {
    if (error instanceof EmailAPIError && error.code === 'recipient_suppressed') {
      const { error: logError } = await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'suppressed',
      })
      if (logError) console.error('Failed to log suppressed email', logError)

      console.log('Email suppressed', { templateName })
      return new Response(
        JSON.stringify({ success: false, reason: 'email_suppressed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('Email send failed', { templateName, error: errorMsg })
    const { error: logError } = await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: errorMsg.slice(0, 1000),
    })
    if (logError) console.error('Failed to log failed email', logError)

    return new Response(JSON.stringify({ error: 'Failed to send email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { error: logError } = await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: 'sent',
  })
  if (logError) console.error('Failed to log sent email', logError)

  console.log('Transactional email sent', { templateName, normalizedEmail })

  return new Response(JSON.stringify({ success: true, sent: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
