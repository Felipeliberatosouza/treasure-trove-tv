// Renderer compartilhado para e-mails configurados no Painel Administrativo
// (tabela `email_templates`). Mantém o MESMO layout/cores/logo da
// pré-visualização do admin (SettingsEmailTemplates.tsx).
//
// Usado por:
//   - send-transactional-email (todos os templates transacionais)
//   - auth-email-hook (signup, recovery, etc., mapeados para template_key)
//
// Retorna `null` quando não há linha em `email_templates` ou o body_html
// está vazio — o caller deve então usar o template React de fallback.
import { buildEmailLogoHtml, escapeHtml, resolveEmailLogoUrl } from './email-logo.ts'

export interface RenderAdminEmailResult {
  html: string
  text: string
  subject: string
  fromHeader: string
}

export interface RenderAdminEmailParams {
  supabase: any
  templateKey: string
  templateData: Record<string, any>
  fallbackSubject: string
  fallbackFromDomain: string
  fallbackSiteName: string
}

export async function renderAdminEmail(
  params: RenderAdminEmailParams,
): Promise<RenderAdminEmailResult | null> {
  const {
    supabase,
    templateKey,
    templateData,
    fallbackSubject,
    fallbackFromDomain,
    fallbackSiteName,
  } = params

  try {
    const { data: brandingRow } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'branding')
      .maybeSingle()
    const brandingVal = (brandingRow?.value as any) || {}
    const platformName = brandingVal.platform_name
      ? String(brandingVal.platform_name)
      : fallbackSiteName

    const { data: contactRow } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'contact')
      .maybeSingle()
    const contactVal = (contactRow?.value as any) || {}

    const { data: tpl } = await supabase
      .from('email_templates')
      .select(
        'from_email, from_name, subject, body_html, logo_url, logo_variant, use_uploaded_logo, text_color, heading_color, link_color, button_color, button_text_color, slogan_color, font_family, show_social_footer',
      )
      .eq('template_key', templateKey)
      .maybeSingle()

    if (!tpl || !tpl.body_html || !String(tpl.body_html).trim()) {
      return null
    }

    // Sender
    const customEmail = (tpl.from_email || '').trim()
    const customName = (tpl.from_name || '').trim()
    const senderName = customName || platformName
    const fromHeader = customEmail
      ? `${senderName} <${customEmail}>`
      : `${senderName} <noreply@${fallbackFromDomain}>`

    // Placeholders
    const mergedData = { platform_name: platformName, ...templateData }
    const renderPlaceholders = (s: string) =>
      s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m: string, k: string) => {
        const v = (mergedData as any)?.[k]
        return v === undefined || v === null ? '' : String(v)
      })

    const customSubject = (tpl.subject || '').trim()
    const subject = customSubject ? renderPlaceholders(customSubject) : fallbackSubject

    // Visual tokens
    const textColor = tpl.text_color || '#333333'
    const headingColor = tpl.heading_color || '#dc2626'
    const linkColor = tpl.link_color || '#6366f1'
    const buttonColor = tpl.button_color || '#6366f1'
    const buttonTextColor = tpl.button_text_color || '#ffffff'
    const sloganColor = tpl.slogan_color || '#6b7280'
    const fontFamily = tpl.font_family || 'Arial, sans-serif'
    const effectiveLogoUrl = resolveEmailLogoUrl(tpl as any, brandingVal as any)

    const logoHtml = buildEmailLogoHtml({
      logoUrl: effectiveLogoUrl,
      useUploadedLogo: tpl.use_uploaded_logo !== false,
      platformName,
      slogan: brandingVal.slogan,
      headingColor,
      sloganColor,
    })

    let body = renderPlaceholders(String(tpl.body_html))
    body = body.replace(/<h([1-3])([^>]*)>/gi, (match: string, level: string, attrs: string) => {
      if (/style=/.test(attrs)) {
        return match.replace(/color:[^;"']*/i, `color:${headingColor}`)
      }
      return `<h${level}${attrs} style="color:${headingColor};">`
    })
    body = body.replace(/background-color:\s*#[0-9a-fA-F]{3,6}/gi, `background-color:${buttonColor}`)
    body = body.replace(/background:\s*#[0-9a-fA-F]{3,6}/gi, `background:${buttonColor}`)
    body = body.replace(
      /(<a\b[^>]*style="[^"]*background(?:-color)?:\s*[^;"]*;[^"]*)(color:\s*#[0-9a-fA-F]{3,6})/gi,
      (_m: string, pre: string) => `${pre}color:${buttonTextColor}`,
    )

    // Footer (contatos + redes sociais)
    let footerHtml = ''
    if (tpl.show_social_footer) {
      const lines: string[] = []
      if (contactVal.email) lines.push(`📧 ${escapeHtml(contactVal.email)}`)
      if (contactVal.phone) lines.push(`📞 ${escapeHtml(contactVal.phone)}`)
      if (contactVal.whatsapp) lines.push(`💬 WhatsApp: ${escapeHtml(contactVal.whatsapp)}`)
      const socials: string[] = []
      const linkStyle = `color:${linkColor};text-decoration:none;`
      if (contactVal.instagram)
        socials.push(
          `<a href="https://instagram.com/${escapeHtml(String(contactVal.instagram).replace('@', ''))}" style="${linkStyle}">Instagram</a>`,
        )
      if (contactVal.youtube)
        socials.push(`<a href="${escapeHtml(contactVal.youtube)}" style="${linkStyle}">YouTube</a>`)
      if (contactVal.facebook)
        socials.push(`<a href="${escapeHtml(contactVal.facebook)}" style="${linkStyle}">Facebook</a>`)
      if (contactVal.tiktok)
        socials.push(
          `<a href="https://tiktok.com/@${escapeHtml(String(contactVal.tiktok).replace('@', ''))}" style="${linkStyle}">TikTok</a>`,
        )
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

    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#f3f4f6;padding:16px 0;">${innerHtml}</body></html>`

    const text = body
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

    return { html, text, subject, fromHeader }
  } catch (e) {
    console.error('renderAdminEmail failed', e)
    return null
  }
}