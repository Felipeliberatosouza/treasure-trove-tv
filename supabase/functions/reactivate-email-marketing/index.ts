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

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Validate JWT to get calling user
  const authHeader = req.headers.get('authorization') ?? ''
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await anonClient.auth.getUser()

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { email, user_id } = await req.json()

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

  // Check if caller is admin
  const { data: isAdmin } = await serviceClient.rpc('has_role', {
    _user_id: user.id,
    _role: 'admin',
  })

  // Non-admin users can only reactivate their own email
  if (!isAdmin) {
    const { data: callerProfile } = await serviceClient
      .from('profiles')
      .select('email')
      .eq('user_id', user.id)
      .single()

    if (!callerProfile || callerProfile.email.toLowerCase() !== email?.toLowerCase()) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  const targetEmail = email.toLowerCase()

  // 1. Remove from suppressed_emails
  const { error: deleteError } = await serviceClient
    .from('suppressed_emails')
    .delete()
    .eq('email', targetEmail)

  if (deleteError) {
    console.error('Failed to remove from suppressed_emails', deleteError)
  }

  // 2. Reset unsubscribe tokens (clear used_at so new tokens can be generated)
  const { error: tokenError } = await serviceClient
    .from('email_unsubscribe_tokens')
    .delete()
    .eq('email', targetEmail)

  if (tokenError) {
    console.error('Failed to clean unsubscribe tokens', tokenError)
  }

  // 3. Update accepts_marketing on profile
  const targetUserId = user_id || user.id
  const { error: profileError } = await serviceClient
    .from('profiles')
    .update({ accepts_marketing: true })
    .eq('user_id', targetUserId)

  if (profileError) {
    console.error('Failed to update profile', profileError)
    return new Response(JSON.stringify({ error: 'Failed to reactivate' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Email marketing reactivated', { email: targetEmail, by: user.id })

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
