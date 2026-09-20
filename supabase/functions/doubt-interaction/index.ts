import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { moderateDoubtText, DEFAULT_BAD_WORDS } from '../_shared/doubt-moderation.ts'

// Chat de dúvidas das aulas com professor virtual (IA).
// Ações: create (aluno abre a dúvida), reply (aluno interage),
// answer (professor da área responde).

interface DoubtChatConfig {
  enabled: boolean
  interactions_no_plan: number
  plan_interactions: Record<string, number | null>
  credit_cost_per_interaction: number
  response_deadline_days: number
  max_teachers_notified: number
  teacher_bonus_brl: number
  blocked_words: string[]
}

const DEFAULT_CONFIG: DoubtChatConfig = {
  enabled: true,
  interactions_no_plan: 1,
  plan_interactions: {},
  credit_cost_per_interaction: 1,
  response_deadline_days: 3,
  max_teachers_notified: 10,
  teacher_bonus_brl: 0,
  blocked_words: DEFAULT_BAD_WORDS,
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const admin = createClient(url, serviceKey)

  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Autenticação necessária.' }, 401)
    const token = authHeader.replace('Bearer ', '')
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData } = await userClient.auth.getUser(token)
    const user = userData?.user
    if (!user) return json({ error: 'Autenticação necessária.' }, 401)

    const body = await req.json()
    const action: string = body.action

    const { data: cfgRow } = await admin
      .from('platform_settings').select('value').eq('key', 'doubt_chat_config').maybeSingle()
    const cfg: DoubtChatConfig = { ...DEFAULT_CONFIG, ...((cfgRow?.value as Partial<DoubtChatConfig>) || {}) }
    if (!cfg.blocked_words?.length) cfg.blocked_words = DEFAULT_BAD_WORDS

    const origin: string = body.origin || 'https://revisaofacil.com.br'

    const sendEmail = async (templateName: string, to: string, templateData: Record<string, unknown>, idem: string) => {
      try {
        await fetch(`${url}/functions/v1/send-app-email`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateName, recipientEmail: to, idempotencyKey: idem, templateData }),
        })
      } catch (e) {
        console.error('email error', templateName, e)
      }
    }

    // ---------------------------------------------------------------- create
    if (action === 'create') {
      if (!cfg.enabled) return json({ error: 'O envio de dúvidas está temporariamente desativado.' }, 200)

      const question = String(body.question || '').trim()
      if (question.length < 10) return json({ error: 'Escreva sua dúvida com pelo menos 10 caracteres.' }, 200)

      const areaIds: string[] = Array.isArray(body.areaIds) ? body.areaIds.filter(Boolean) : []
      const moderation = moderateDoubtText(question, cfg.blocked_words)

      // limite de interações conforme plano ativo
      let limit: number | null = cfg.interactions_no_plan
      const { data: sub } = await admin
        .from('student_subscriptions')
        .select('plan_id, status, expires_at, subscription_plans(name)')
        .eq('user_id', user.id).eq('status', 'active')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      const planName = (sub as any)?.subscription_plans?.name as string | undefined
      if (planName && Object.prototype.hasOwnProperty.call(cfg.plan_interactions, planName)) {
        limit = cfg.plan_interactions[planName]
      }

      const doubtId = crypto.randomUUID()
      const { error: dErr } = await admin.from('student_doubts').insert({
        id: doubtId,
        student_id: user.id,
        teacher_id: null,
        content_id: body.contentId ?? null,
        content_type: body.contentType ?? 'ai_content',
        audience: 'area',
        area_ids: areaIds,
        subject: body.subject ?? null,
        question,
        status: moderation.blocked ? 'rejected' : 'approved',
        interactions_limit: limit,
        interactions_used: moderation.blocked ? 0 : 1,
        approved_at: moderation.blocked ? null : new Date().toISOString(),
      })
      if (dErr) return json({ error: 'Erro ao enviar dúvida. Tente novamente.' }, 200)

      await admin.from('doubt_messages').insert({
        doubt_id: doubtId,
        author_id: user.id,
        author_role: 'student',
        message_kind: 'question',
        body: question,
        status: moderation.blocked ? 'blocked' : 'approved',
        blocked: moderation.blocked,
        block_reason: moderation.reason,
        block_matches: moderation.matches,
      })

      if (moderation.blocked) {
        return json({ blocked: true, reason: moderation.reason })
      }

      // convoca professores da(s) área(s)
      let areaNames: string[] = []
      if (areaIds.length) {
        const { data: areas } = await admin.from('course_areas').select('name').in('id', areaIds)
        areaNames = (areas || []).map((a: any) => a.name)
      }

      const { data: teacherRoles } = await admin.from('user_roles').select('user_id').eq('role', 'teacher')
      const teacherIds = (teacherRoles || []).map((r: any) => r.user_id)
      let teachers: any[] = []
      if (teacherIds.length) {
        let q = admin.from('profiles')
          .select('user_id, name, email, areas, receives_doubt_emails')
          .in('user_id', teacherIds).eq('active', true)
        const { data: profs } = await q
        teachers = (profs || []).filter((p: any) =>
          areaNames.length === 0 || (p.areas || []).some((a: string) => areaNames.includes(a))
        ).slice(0, Math.max(1, cfg.max_teachers_notified))
      }

      if (teachers.length) {
        await admin.from('doubt_area_invites').insert(
          teachers.map((t) => ({ doubt_id: doubtId, teacher_id: t.user_id, notified_at: new Date().toISOString() }))
        )
        const bonusText = cfg.teacher_bonus_brl > 0
          ? `Esta dúvida tem bônus de R$ ${cfg.teacher_bonus_brl.toFixed(2).replace('.', ',')} por resposta aprovada.`
          : undefined
        for (const t of teachers) {
          if (t.receives_doubt_emails === false || !t.email) continue
          await sendEmail('doubt-area-invite', t.email, {
            teacherName: t.name,
            areaName: areaNames.join(', '),
            subject: body.subject ?? '',
            question,
            doubtUrl: `${origin}/dashboard?tab=duvidas&doubt=${doubtId}`,
            bonusText,
          }, `doubt-invite-${doubtId}-${t.user_id}`)
        }
      }

      return json({ ok: true, doubtId, notified: teachers.length, limit })
    }

    // ----------------------------------------------------------------- reply
    if (action === 'reply') {
      const doubtId = String(body.doubtId || '')
      const message = String(body.body || '').trim()
      if (message.length < 5) return json({ error: 'Escreva pelo menos 5 caracteres.' }, 200)

      const { data: doubt } = await admin.from('student_doubts').select('*').eq('id', doubtId).maybeSingle()
      if (!doubt || doubt.student_id !== user.id) return json({ error: 'Dúvida não encontrada.' }, 200)

      const moderation = moderateDoubtText(message, cfg.blocked_words)
      if (moderation.blocked) {
        await admin.from('doubt_messages').insert({
          doubt_id: doubtId, author_id: user.id, author_role: 'student', message_kind: 'question',
          body: message, status: 'blocked', blocked: true,
          block_reason: moderation.reason, block_matches: moderation.matches,
        })
        return json({ blocked: true, reason: moderation.reason })
      }

      const limit: number | null = doubt.interactions_limit
      const used: number = doubt.interactions_used || 0
      let paidWithCredits = false

      if (limit !== null && used >= limit) {
        const cost = Math.max(0, cfg.credit_cost_per_interaction)
        if (!body.useCredits) {
          return json({ needsCredits: true, cost, error: 'Limite de interações atingido.' })
        }
        const { data: bal } = await admin.from('ai_revision_credits')
          .select('balance').eq('user_id', user.id).maybeSingle()
        const balance = bal?.balance ?? 0
        if (cost > 0 && balance < cost) {
          return json({ insufficientCredits: true, cost, balance, error: 'Créditos de IA insuficientes.' })
        }
        if (cost > 0) {
          const newBalance = balance - cost
          await admin.from('ai_revision_credits').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', user.id)
          await admin.from('ai_revision_credit_ledger').insert({
            user_id: user.id, delta: -cost, reason: 'doubt_interaction', balance_after: newBalance,
          })
          paidWithCredits = true
        }
        await admin.from('student_doubts').update({
          interactions_limit: (limit || 0) + 1,
          credits_spent: (doubt.credits_spent || 0) + cost,
        }).eq('id', doubtId)
      }

      const { error: mErr } = await admin.from('doubt_messages').insert({
        doubt_id: doubtId, author_id: user.id, author_role: 'student', message_kind: 'question',
        body: message, status: 'approved', paid_with_credits: paidWithCredits,
      })
      if (mErr) return json({ error: mErr.message }, 200)

      await admin.from('student_doubts').update({
        interactions_used: used + 1,
        status: 'approved',
        updated_at: new Date().toISOString(),
      }).eq('id', doubtId)

      // avisa os professores convocados que optaram por receber e-mails
      const { data: invites } = await admin.from('doubt_area_invites').select('teacher_id').eq('doubt_id', doubtId)
      const ids = (invites || []).map((i: any) => i.teacher_id)
      if (ids.length) {
        const { data: profs } = await admin.from('profiles')
          .select('user_id, name, email, receives_doubt_emails').in('user_id', ids)
        for (const t of profs || []) {
          if ((t as any).receives_doubt_emails === false || !(t as any).email) continue
          await sendEmail('doubt-area-invite', (t as any).email, {
            teacherName: (t as any).name,
            subject: doubt.subject ?? '',
            question: message,
            doubtUrl: `${origin}/dashboard?tab=duvidas&doubt=${doubtId}`,
          }, `doubt-reply-${doubtId}-${(t as any).user_id}-${Date.now()}`)
        }
      }

      return json({ ok: true, paidWithCredits })
    }

    // ---------------------------------------------------------------- answer
    if (action === 'answer') {
      const doubtId = String(body.doubtId || '')
      const message = String(body.body || '').trim()
      if (message.length < 5) return json({ error: 'Escreva pelo menos 5 caracteres.' }, 200)

      const { data: canAccess } = await userClient.rpc('can_teacher_access_doubt', { _doubt_id: doubtId })
      if (!canAccess) return json({ error: 'Você não tem acesso a esta dúvida.' }, 200)

      const moderation = moderateDoubtText(message, cfg.blocked_words)
      if (moderation.blocked) {
        await admin.from('doubt_messages').insert({
          doubt_id: doubtId, author_id: user.id, author_role: 'teacher', message_kind: 'answer',
          body: message, status: 'blocked', blocked: true,
          block_reason: moderation.reason, block_matches: moderation.matches,
        })
        return json({ blocked: true, reason: moderation.reason })
      }

      const { data: inserted, error: mErr } = await admin.from('doubt_messages').insert({
        doubt_id: doubtId, author_id: user.id, author_role: 'teacher', message_kind: 'answer',
        body: message, status: 'approved', bonus_amount: cfg.teacher_bonus_brl || 0,
      }).select('id').single()
      if (mErr) return json({ error: mErr.message }, 200)

      await admin.from('doubt_area_invites').upsert(
        { doubt_id: doubtId, teacher_id: user.id, responded_at: new Date().toISOString() },
        { onConflict: 'doubt_id,teacher_id' }
      )

      if (cfg.teacher_bonus_brl > 0) {
        await admin.from('doubt_teacher_rewards').insert({
          doubt_id: doubtId, message_id: inserted.id, teacher_id: user.id,
          amount: cfg.teacher_bonus_brl, status: 'pending',
        })
      }

      const { data: doubt } = await admin.from('student_doubts').select('*').eq('id', doubtId).maybeSingle()
      await admin.from('student_doubts').update({
        status: 'answered',
        answer: message,
        answered_at: new Date().toISOString(),
      }).eq('id', doubtId)

      if (doubt) {
        const [{ data: student }, { data: teacher }] = await Promise.all([
          admin.from('profiles').select('name, email').eq('user_id', doubt.student_id).maybeSingle(),
          admin.from('profiles').select('name').eq('user_id', user.id).maybeSingle(),
        ])
        if (student?.email) {
          await sendEmail('doubt-new-answer', student.email, {
            studentName: student.name,
            teacherName: teacher?.name ? `Prof. ${teacher.name}` : 'Um professor',
            question: doubt.question,
            answer: message,
            doubtUrl: `${origin}/minhas-duvidas`,
          }, `doubt-answer-${inserted.id}`)
        }
      }

      return json({ ok: true })
    }

    return json({ error: 'Ação inválida.' }, 400)
  } catch (e) {
    console.error('doubt-interaction error', e)
    return json({ error: 'Erro inesperado. Tente novamente.' }, 500)
  }
})
