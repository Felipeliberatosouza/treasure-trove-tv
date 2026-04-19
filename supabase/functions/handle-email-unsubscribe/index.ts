import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  const url = new URL(req.url)
  let token: string | null = url.searchParams.get('token')
  // scope: 'all' = suppress all emails (current behavior)
  //        'marketing' = only opt-out of marketing emails (transactional still sent)
  //        'feedback' = save a reason on suppressed_emails.metadata after unsubscribe
  let scope: 'all' | 'marketing' | 'feedback' = 'all'
  let isOneClick = false
  let feedbackReason: string | null = null
  let feedbackComment: string | null = null

  if (req.method === 'POST') {
    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formText = await req.text()
      const params = new URLSearchParams(formText)
      // RFC 8058 one-click unsubscribe → always treat as 'all' (full opt-out)
      if (params.get('List-Unsubscribe') === 'One-Click') {
        isOneClick = true
        scope = 'all'
      } else {
        const formToken = params.get('token')
        if (formToken) token = formToken
        const formScope = params.get('scope')
        if (formScope === 'marketing' || formScope === 'all' || formScope === 'feedback') scope = formScope
        const fr = params.get('feedback_reason')
        if (fr) feedbackReason = fr
        const fc = params.get('feedback_comment')
        if (fc) feedbackComment = fc
      }
    } else {
      try {
        const body = await req.json()
        if (body.token) token = body.token
        if (body.scope === 'marketing' || body.scope === 'all' || body.scope === 'feedback') scope = body.scope
        if (typeof body.feedback_reason === 'string') feedbackReason = body.feedback_reason
        if (typeof body.feedback_comment === 'string') feedbackComment = body.feedback_comment
      } catch {
        // Fall through
      }
    }
  }

  if (!token) {
    return jsonResponse({ error: 'Token is required' }, 400)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: tokenRecord, error: lookupError } = await supabase
    .from('email_unsubscribe_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (lookupError || !tokenRecord) {
    return jsonResponse({ error: 'Invalid or expired token' }, 404)
  }

  const normalizedEmail = tokenRecord.email.toLowerCase()

  // Look up the user's name and current marketing preference for a friendlier UX
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, accepts_marketing')
    .eq('email', normalizedEmail)
    .maybeSingle()

  // Check if email is already fully suppressed
  const { data: suppression } = await supabase
    .from('suppressed_emails')
    .select('email')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (tokenRecord.used_at && suppression) {
    return jsonResponse({
      valid: false,
      reason: 'already_unsubscribed',
      name: profile?.name ?? null,
    })
  }

  // GET: return validation + user info so the page can personalize
  if (req.method === 'GET') {
    return jsonResponse({
      valid: true,
      name: profile?.name ?? null,
      email: normalizedEmail,
      accepts_marketing: profile?.accepts_marketing ?? false,
      already_suppressed: !!suppression,
    })
  }

  // POST scope === 'feedback': merge a reason into suppressed_emails.metadata
  // (only valid after a full unsubscribe — i.e. there must be a suppression row)
  if (scope === 'feedback') {
    const allowedReasons = ['too_many', 'not_relevant', 'never_signed_up', 'other']
    if (!feedbackReason || !allowedReasons.includes(feedbackReason)) {
      return jsonResponse({ error: 'Invalid feedback reason' }, 400)
    }
    if (!suppression) {
      // Nothing to attach feedback to — silently succeed so UI is resilient
      return jsonResponse({ success: true, scope: 'feedback', skipped: true })
    }
    const { data: existing } = await supabase
      .from('suppressed_emails')
      .select('metadata')
      .eq('email', normalizedEmail)
      .maybeSingle()
    const mergedMetadata = {
      ...((existing?.metadata as Record<string, unknown>) ?? {}),
      feedback_reason: feedbackReason,
      feedback_comment: feedbackComment?.slice(0, 500) ?? null,
      feedback_submitted_at: new Date().toISOString(),
    }
    const { error: feedbackError } = await supabase
      .from('suppressed_emails')
      .update({ metadata: mergedMetadata })
      .eq('email', normalizedEmail)
    if (feedbackError) {
      console.error('Failed to save feedback', { error: feedbackError, email: normalizedEmail })
      return jsonResponse({ error: 'Failed to save feedback' }, 500)
    }
    console.log('Unsubscribe feedback saved', { email: normalizedEmail, reason: feedbackReason })
    return jsonResponse({ success: true, scope: 'feedback' })
  }

  // POST: process the unsubscribe according to scope
  if (scope === 'marketing') {
    // Marketing-only opt-out: just flip accepts_marketing on the profile.
    // Do NOT add to suppressed_emails (transactional still flows) and do NOT
    // mark the token as used — user may come back later for full unsubscribe.
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ accepts_marketing: false })
      .eq('email', normalizedEmail)

    if (profileError) {
      console.error('Failed to opt out of marketing', { error: profileError, email: normalizedEmail })
      return jsonResponse({ error: 'Failed to process unsubscribe' }, 500)
    }

    console.log('Marketing opt-out processed', { email: normalizedEmail })
    return jsonResponse({ success: true, scope: 'marketing', name: profile?.name ?? null })
  }

  // scope === 'all' → full unsubscribe (atomic check-and-update)
  const { data: updated, error: updateError } = await supabase
    .from('email_unsubscribe_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
    .is('used_at', null)
    .select()
    .maybeSingle()

  if (updateError) {
    console.error('Failed to mark token as used', { error: updateError, token })
    return jsonResponse({ error: 'Failed to process unsubscribe' }, 500)
  }

  // Even if token was already used, still ensure suppression is in place
  // (idempotent — covers one-click retries from email clients)
  if (!updated && !isOneClick) {
    return jsonResponse({ success: false, reason: 'already_unsubscribed', name: profile?.name ?? null })
  }

  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert(
      { email: normalizedEmail, reason: 'unsubscribe' },
      { onConflict: 'email' },
    )

  if (suppressError) {
    console.error('Failed to suppress email', { error: suppressError, email: normalizedEmail })
    return jsonResponse({ error: 'Failed to process unsubscribe' }, 500)
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ accepts_marketing: false })
    .eq('email', normalizedEmail)

  if (profileError) {
    console.error('Failed to update accepts_marketing on profile', {
      error: profileError,
      email: normalizedEmail,
    })
  }

  console.log('Email fully unsubscribed', { email: normalizedEmail })

  return jsonResponse({ success: true, scope: 'all', name: profile?.name ?? null })
})
