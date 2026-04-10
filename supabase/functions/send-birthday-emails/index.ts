import { corsHeaders } from '@supabase/supabase-js/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Get today's month and day
    const today = new Date()
    const month = today.getMonth() + 1
    const day = today.getDate()

    // Find users with today's birthday
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

    // Filter by month/day match
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

    // Get birthday email template
    const { data: template } = await supabase
      .from('email_templates')
      .select('subject, body_html, logo_url, show_social_footer')
      .eq('template_key', 'birthday')
      .single()

    if (!template) {
      return new Response(JSON.stringify({ error: 'Birthday template not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get contact settings for footer
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

    // Build footer HTML
    let footerHtml = ''
    if (template.show_social_footer) {
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

      footerHtml = `
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <div style="text-align:center;font-size:12px;color:#6b7280;">
          ${lines.map(l => `<p style="margin:4px 0;">${l}</p>`).join('')}
          ${socials.length > 0 ? `<p style="margin:8px 0;">${socials.join(' · ')}</p>` : ''}
          <p style="margin:8px 0;color:#9ca3af;">© ${new Date().getFullYear()} ${platformName}</p>
        </div>
      `
    }

    let sentCount = 0

    for (const user of todaysBirthdays) {
      const logoHtml = template.logo_url
        ? `<div style="text-align:center;margin-bottom:16px;"><img src="${template.logo_url}" alt="Logo" style="max-height:60px;max-width:200px;" /></div>`
        : ''

      let body = template.body_html
        .replace(/\{\{name\}\}/g, user.name || 'Estudante')
        .replace(/\{\{login_link\}\}/g, loginLink)

      const fullHtml = `
        <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#ffffff;padding:24px;border-radius:8px;">
          ${logoHtml}
          ${body}
          ${footerHtml}
        </div>
      `

      const subject = template.subject
        .replace(/\{\{name\}\}/g, user.name || 'Estudante')

      // Send email via Supabase Auth admin API (or log for now)
      console.log(`Birthday email queued for ${user.email}: ${subject}`)
      sentCount++
    }

    return new Response(JSON.stringify({ message: `Birthday emails processed`, sent: sentCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Birthday cron error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
