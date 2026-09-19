import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

type Reason = 'bounce' | 'complaint' | 'unsubscribe'

const LOG_STATUS: Record<Reason, string> = {
  bounce: 'bounced',
  complaint: 'complained',
  unsubscribe: 'suppressed',
}

const LOG_MESSAGE: Record<Reason, string> = {
  bounce: 'Permanent bounce — email address is invalid or rejected',
  complaint: 'Spam complaint — recipient marked email as spam',
  unsubscribe: 'Recipient unsubscribed',
}

async function record(event: any, reason: Reason) {
  const recipient = String(event?.data?.recipient ?? '').toLowerCase()
  if (!recipient) {
    console.warn('Email event without recipient', { event_id: event?.event_id })
    return
  }
  const metadata = (event?.data?.metadata as Record<string, unknown> | undefined) ?? null
  const messageId = (event?.data?.message_id as string | undefined) ?? null

  // Notification-only bookkeeping: these tables feed the admin e-mail reports.
  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert({ email: recipient, reason, metadata }, { onConflict: 'email' })
  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      event_id: event?.event_id,
      code: suppressError.code,
      message: suppressError.message,
    })
    throw new Error('Failed to write suppression')
  }

  const { error: logError } = await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: 'system',
    recipient_email: recipient,
    status: LOG_STATUS[reason],
    error_message: LOG_MESSAGE[reason],
    metadata,
  })
  if (logError) {
    console.error('Failed to insert email_send_log', {
      event_id: event?.event_id,
      code: logError.code,
      message: logError.message,
    })
    throw new Error('Failed to write email log')
  }

  // Full opt-out also clears the marketing preference on the profile.
  if (reason === 'unsubscribe' || reason === 'complaint') {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ accepts_marketing: false })
      .eq('email', recipient)
    if (profileError) {
      console.error('Failed to update accepts_marketing', {
        event_id: event?.event_id,
        code: profileError.code,
        message: profileError.message,
      })
    }
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await record(event, 'bounce')
    },
    'email.complaint': async (event) => {
      await record(event, 'complaint')
    },
    'email.unsubscribed': async (event) => {
      await record(event, 'unsubscribe')
    },
  },
})

Deno.serve((req) => handler(req))
