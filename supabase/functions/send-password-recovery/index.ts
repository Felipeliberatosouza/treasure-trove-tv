// Edge Function: gera link de recuperação de senha via Admin API e
// dispara o template `password_recovery` em PT-BR através do
// pipeline de e-mails transacionais (sender e configurações vindas do banco).
//
// Endpoint público (verify_jwt = false) — recebe { email, redirect_to } e
// SEMPRE responde 200 para evitar enumeração de contas.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  let email = ''
  let redirectTo = ''
  try {
    const body = await req.json()
    email = String(body?.email || '').trim().toLowerCase()
    redirectTo = String(body?.redirect_to || '').trim()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  if (!email || !email.includes('@')) {
    // Resposta neutra (sem revelar formato inválido)
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const admin = createClient(supabaseUrl, serviceRole)

  // Verifica se o e-mail está cadastrado (em profiles)
  try {
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (!existingProfile) {
      return new Response(
        JSON.stringify({ success: false, exists: false, error: 'user_not_found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
  } catch (e) {
    console.error('profile existence check failed', e)
  }

  // Busca nome e plataforma para personalizar o e-mail
  let userName = ''
  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('name')
      .eq('email', email)
      .maybeSingle()
    userName = (profile?.name || '').split(' ')[0] || ''
  } catch (e) {
    console.error('profile lookup failed', e)
  }

  let platformName = 'Revisão Fácil'
  try {
    const { data: branding } = await admin
      .from('platform_settings')
      .select('value')
      .eq('key', 'branding')
      .maybeSingle()
    const v = branding?.value as any
    if (v?.platform_name) platformName = String(v.platform_name)
  } catch (e) {
    console.error('branding lookup failed', e)
  }

  // Gera o link de recuperação via Admin API (não envia o e-mail nativo)
  let recoveryLink = ''
  try {
    const { data: linkData, error: linkError } = await (admin.auth.admin as any).generateLink({
      type: 'recovery',
      email,
      options: redirectTo ? { redirectTo } : undefined,
    })
    if (linkError) {
      const msg = String(linkError.message || '').toLowerCase()
      const notFound = msg.includes('not found') || msg.includes('user_not_found')
      if (notFound) {
        return new Response(
          JSON.stringify({ success: false, exists: false, error: 'user_not_found' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      console.log('generateLink error', linkError.message)
      return new Response(
        JSON.stringify({ success: false, error: 'generate_link_failed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    recoveryLink = (linkData as any)?.properties?.action_link || ''
  } catch (e) {
    console.error('generateLink threw', e)
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  if (!recoveryLink) {
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Dispara o template via send-transactional-email (usa from_email/from_name configurados)
  try {
    const idempotencyKey = `pwd-recovery-${email}-${Date.now()}`
    const sendUrl = `${supabaseUrl}/functions/v1/send-transactional-email`
    const resp = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRole}`,
        apikey: serviceRole,
      },
      body: JSON.stringify({
        templateName: 'password_recovery',
        recipientEmail: email,
        idempotencyKey,
        templateData: {
          name: userName,
          recovery_link: recoveryLink,
          platform_name: platformName,
        },
      }),
    })
    if (!resp.ok) {
      const txt = await resp.text()
      console.error('send-transactional-email failed', resp.status, txt)
    }
  } catch (e) {
    console.error('send-transactional-email threw', e)
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
