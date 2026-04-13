/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Revisão Fácil'

interface Props {
  studentName?: string
  studentEmail?: string
  actionType?: string // 'plan-change' | 'cancellation'
  previousPlan?: string
  newPlan?: string
  changeType?: string // 'upgrade' | 'downgrade'
  proRataAmount?: string
  proRataExplanation?: string
  effectiveDate?: string
}

const SubscriptionChangeAdminNotifyEmail = ({
  studentName = 'Aluno',
  studentEmail = '',
  actionType = 'plan-change',
  previousPlan = '',
  newPlan = '',
  changeType = 'upgrade',
  proRataAmount = '',
  proRataExplanation = '',
  effectiveDate = '',
}: Props) => {
  const isCancellation = actionType === 'cancellation'
  const title = isCancellation ? 'Assinatura Cancelada ⚠️' : 'Mudança de Plano 🔄'
  const previewText = isCancellation
    ? `${studentName} cancelou a assinatura`
    : `${studentName} alterou o plano`

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{previewText} — {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{title}</Heading>
          <Text style={text}>
            O aluno <strong>{studentName}</strong> ({studentEmail}) {isCancellation ? 'cancelou sua assinatura' : 'alterou seu plano de assinatura'}.
          </Text>

          <Section style={infoBox}>
            {isCancellation ? (
              <>
                <Text style={infoText}><strong>Plano cancelado:</strong> {previousPlan}</Text>
              </>
            ) : (
              <>
                <Text style={infoText}><strong>Plano anterior:</strong> {previousPlan}</Text>
                <Text style={infoText}><strong>Novo plano:</strong> {newPlan}</Text>
                <Text style={infoText}><strong>Tipo:</strong> {changeType === 'upgrade' ? 'Upgrade' : 'Downgrade'}</Text>
              </>
            )}
            {effectiveDate && (
              <Text style={infoText}><strong>Data:</strong> {effectiveDate}</Text>
            )}
          </Section>

          {proRataAmount && (
            <Section style={calculationBox}>
              <Text style={calculationTitle}>Cálculo proporcional</Text>
              <Text style={calculationAmount}><strong>{proRataAmount}</strong></Text>
              {proRataExplanation && (
                <Text style={calculationExplanation}>{proRataExplanation}</Text>
              )}
            </Section>
          )}

          <Hr style={hr} />
          <Text style={footer}>Notificação automática — {SITE_NAME}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: SubscriptionChangeAdminNotifyEmail,
  subject: (data: Record<string, any>) =>
    data?.actionType === 'cancellation'
      ? `Cancelamento: ${data?.studentName || 'Aluno'} cancelou assinatura — ${SITE_NAME}`
      : `Mudança de plano: ${data?.studentName || 'Aluno'} — ${SITE_NAME}`,
  displayName: 'Notificação admin — mudança/cancelamento de plano',
  previewData: {
    studentName: 'João Silva',
    studentEmail: 'joao@email.com',
    actionType: 'plan-change',
    previousPlan: 'Plano Mensal',
    newPlan: 'Plano Trimestral',
    changeType: 'upgrade',
    proRataAmount: 'R$ 25,00',
    proRataExplanation: 'Diferença proporcional de 15 dias restantes.',
    effectiveDate: '13/04/2026',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const infoBox = { backgroundColor: '#fef2f2', borderRadius: '8px', padding: '16px', margin: '0 0 16px' }
const infoText = { fontSize: '14px', color: '#374151', margin: '0 0 4px' }
const calculationBox = { backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px', margin: '0 0 16px', borderLeft: '4px solid #6366f1' }
const calculationTitle = { fontSize: '14px', fontWeight: 'bold' as const, color: '#374151', margin: '0 0 8px' }
const calculationAmount = { fontSize: '16px', color: '#111827', margin: '0 0 8px' }
const calculationExplanation = { fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '0' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }
