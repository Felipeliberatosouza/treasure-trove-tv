import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'
import { buildEmailLogoHtml, escapeHtml, resolveEmailLogoUrl } from '../_shared/email-logo.ts'

// Configuration baked in at scaffold time — do NOT change these manually.
// To update, re-run the email domain setup flow.
const SITE_NAME = "Premium Video Club"
// SENDER_DOMAIN is the verified sender subdomain FQDN (e.g., "notify.example.com").
// It MUST match the subdomain delegated to Lovable's nameservers — never the root domain.
// The email API looks up this exact domain; a mismatch causes "No email domain record found".
const SENDER_DOMAIN = "notify.revisaofacil.com.br"
// FROM_DOMAIN is the domain shown in the From: header (e.g., "example.com").
// When display_from_root is enabled, this can be the root domain for cleaner branding,
// even though actual sending uses the subdomain above.
const FROM_DOMAIN = "notify.revisaofacil.com.br"

// Maps registry template names (kebab-case used in code) to the
// `template_key` column used in the `email_templates` admin table.
// Without this mapping the admin-configured HTML/subject/sender are
// ignored and the React fallback template is sent instead.
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
  'doubt-sent-confirmation': 'doubt_submitted',
  'payment-confirmation': 'payment_confirmation',
  'subscription-cancelled': 'subscription_cancelled',
  'password-changed-admin': 'password_changed_admin',
}

function resolveAdminTemplateKey(name: string): string {
  return TEMPLATE_KEY_ALIAS[name] || name
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

// Generate a cryptographically random 32-byte hex token
function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Validate JWT in code (verify_jwt = false in config.toml for Lovable Cloud compatibility)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Verify the caller. Service-role calls (server-to-server / edge functions
  // invoking this function) bypass JWT verification. Otherwise validate the
  // user's JWT via getClaims and infer the role from the claims payload.
  const token = authHeader.replace('Bearer ', '')
  let callerRole = 'anon'
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const publishableKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || ''
  if (token === supabaseServiceKey) {
    callerRole = 'service_role'
  } else if (token && (token === anonKey || token === publishableKey)) {
    // Unauthenticated client call using the public anon/publishable key.
    callerRole = 'anon'
  } else {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      // Fallback: treat as anon (template allow-list still gates access below).
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

  // Parse request body
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
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (!templateName) {
    return new Response(
      JSON.stringify({ error: 'templateName is required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (callerRole === 'anon' && !PUBLIC_ANON_TEMPLATES.has(templateName)) {
    return new Response(
      JSON.stringify({ error: 'Forbidden: template not available for anonymous callers' }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 1. Look up template from registry (early — needed to resolve recipient)
  const template = TEMPLATES[templateName]

  if (!template) {
    console.error('Template not found in registry', { templateName })
    return new Response(
      JSON.stringify({
        error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`,
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Resolve effective recipient: template-level `to` takes precedence over
  // the caller-provided recipientEmail. This allows notification templates
  // to always send to a fixed address (e.g., site owner from env var).
  const effectiveRecipient = template.to || recipientEmail

  if (!effectiveRecipient) {
    return new Response(
      JSON.stringify({
        error: 'recipientEmail is required (unless the template defines a fixed recipient)',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Create Supabase client with service role (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Dedupe: certain templates must be sent at most once per recipient.
  // Prevents duplicate welcome e-mails if the user signs in multiple times
  // after confirming the e-mail.
  const ONCE_PER_RECIPIENT = new Set<string>([
    'welcome-student',
    'welcome-teacher',
  ])
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

  // 2. Check suppression list (fail-closed: if we can't verify, don't send)
  const { data: suppressed, error: suppressionError } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', effectiveRecipient.toLowerCase())
    .maybeSingle()

  if (suppressionError) {
    console.error('Suppression check failed — refusing to send', {
      error: suppressionError,
      effectiveRecipient,
    })
    return new Response(
      JSON.stringify({ error: 'Failed to verify suppression status' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (suppressed) {
    // Log the suppressed attempt
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
    })

    console.log('Email suppressed', { effectiveRecipient, templateName })
    return new Response(
      JSON.stringify({ success: false, reason: 'email_suppressed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 3. Get or create unsubscribe token (one token per email address)
  const normalizedEmail = effectiveRecipient.toLowerCase()
  let unsubscribeToken: string

  // Check for existing token for this email
  const { data: existingToken, error: tokenLookupError } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (tokenLookupError) {
    console.error('Token lookup failed', {
      error: tokenLookupError,
      email: normalizedEmail,
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to look up unsubscribe token',
    })
    return new Response(
      JSON.stringify({ error: 'Failed to prepare email' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (existingToken && !existingToken.used_at) {
    // Reuse existing unused token
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    // Create new token — upsert handles concurrent inserts gracefully
    unsubscribeToken = generateToken()
    const { error: tokenError } = await supabase
      .from('email_unsubscribe_tokens')
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: 'email', ignoreDuplicates: true }
      )

    if (tokenError) {
      console.error('Failed to create unsubscribe token', {
        error: tokenError,
      })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to create unsubscribe token',
      })
      return new Response(
        JSON.stringify({ error: 'Failed to prepare email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // If another request raced us, our upsert was silently ignored.
    // Re-read to get the actual stored token.
    const { data: storedToken, error: reReadError } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (reReadError || !storedToken) {
      console.error('Failed to read back unsubscribe token after upsert', {
        error: reReadError,
        email: normalizedEmail,
      })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to confirm unsubscribe token storage',
      })
      return new Response(
        JSON.stringify({ error: 'Failed to prepare email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    unsubscribeToken = storedToken.token
  } else {
    // Token exists but is already used — email should have been caught by suppression check above.
    // This is a safety fallback; log and skip sending.
    console.warn('Unsubscribe token already used but email not suppressed', {
      email: normalizedEmail,
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
      error_message:
        'Unsubscribe token used but email missing from suppressed list',
    })
    return new Response(
      JSON.stringify({ success: false, reason: 'email_suppressed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 4. Inject unsubscribeUrl into templateData.
  // - `unsubscribeUrl` is set whenever the recipient has a profile (i.e. is a
  //   registered user). All emails to registered users include a link to stop
  //   receiving emails — required for transparency/compliance.
  // - `marketingUnsubscribeUrl` is set only when accepts_marketing = true,
  //   for the dedicated marketing footer (kept for backward compatibility).
  const { data: recipientProfile } = await supabase
    .from('profiles')
    .select('accepts_marketing')
    .eq('email', normalizedEmail)
    .maybeSingle()

  const enrichedTemplateData = { ...templateData }
  const baseUrl = Deno.env.get('SUPABASE_URL')
  const unsubscribeUrl = `${baseUrl}/functions/v1/handle-email-unsubscribe?token=${unsubscribeToken}`

  if (recipientProfile) {
    // Registered user → always include unsubscribe link
    enrichedTemplateData.unsubscribeUrl = unsubscribeUrl
  }
  if (recipientProfile?.accepts_marketing) {
    enrichedTemplateData.marketingUnsubscribeUrl = unsubscribeUrl
  }

  // 5. Render React Email template to HTML and plain text
  let html = await renderAsync(
    React.createElement(template.component, enrichedTemplateData)
  )
  let plainText = await renderAsync(
    React.createElement(template.component, enrichedTemplateData),
    { plainText: true }
  )

  // 5.1 Optional discount-coupon banner — admin-configured per template_key
  // Looks up the email_templates row and, when coupon_enabled is true,
  // injects a highly visible coupon block before </body> in the rendered HTML.
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

  // Resolve subject — supports static string or dynamic function
  const resolvedSubject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  // 5.2 Override rendered HTML/subject/sender with admin-configured template
  // (email_templates table). When `body_html` is present, build the email
  // using the SAME wrapper as the admin preview (logo, colors, footer),
  // so the sent e-mail matches what the admin sees in Configurações > E-mails.
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

    // Sender override
    const customEmail = (tplCfg2?.from_email || '').trim()
    const customName = (tplCfg2?.from_name || '').trim()
    const senderName = customName || platformName
    if (customEmail) {
      fromHeader = `${senderName} <${customEmail}>`
    } else {
      fromHeader = `${senderName} <noreply@${FROM_DOMAIN}>`
    }

    // Subject override (with {{placeholders}})
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

    // Body override → build HTML matching the admin preview
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
      // Apply heading color to h1/h2/h3
      body = body.replace(/<h([1-3])([^>]*)>/gi, (match, level, attrs) => {
        if (/style=/.test(attrs)) {
          return match.replace(/color:[^;"']*/i, `color:${headingColor}`)
        }
        return `<h${level}${attrs} style="color:${headingColor};">`
      })
      // Apply button color to elements with explicit background color
      body = body.replace(/background-color:\s*#[0-9a-fA-F]{3,6}/gi, `background-color:${buttonColor}`)
      body = body.replace(/background:\s*#[0-9a-fA-F]{3,6}/gi, `background:${buttonColor}`)
      body = body.replace(
        /(<a\b[^>]*style="[^"]*background(?:-color)?:\s*[^;"]*;[^"]*)(color:\s*#[0-9a-fA-F]{3,6})/gi,
        (_m, pre) => `${pre}color:${buttonTextColor}`
      )

      // Footer (contatos + redes sociais)
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
      // Plain-text fallback: strip tags from the body
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

  // 5. Enqueue the pre-rendered email for async processing by the dispatcher.
  // The dispatcher (process-email-queue) handles sending, retries, and rate-limit backoff.

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: fromHeader,
      sender_domain: SENDER_DOMAIN,
      subject: finalSubject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue email', {
      error: enqueueError,
      templateName,
      effectiveRecipient,
    })

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })

    return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Transactional email enqueued', { templateName, effectiveRecipient })

  return new Response(
    JSON.stringify({ success: true, queued: true }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
})
