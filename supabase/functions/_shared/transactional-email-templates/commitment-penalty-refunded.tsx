/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Revisão Fácil'

interface CommitmentPenaltyRefundedProps {
  name?: string
  refundAmount?: string
  originalPenaltyAmount?: string
  refundType?: 'total' | 'partial' | string
  reason?: string
  processedAt?: string
}

const CommitmentPenaltyRefundedEmail = ({
  name,
  refundAmount = 'R$ 0,00',
  originalPenaltyAmount,
  refundType = 'partial',
  reason,
  processedAt,
}: CommitmentPenaltyRefundedProps) => {
  const isTotal = refundType === 'total'
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Seu reembolso de multa de permanência foi processado</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            {name ? `Olá, ${name}!` : 'Olá!'}
          </Heading>
          <Text style={text}>
            Temos uma boa notícia: a equipe da {SITE_NAME} processou um reembolso
            {isTotal ? ' integral' : ' parcial'} da multa de permanência cobrada
            no cancelamento da sua assinatura.
          </Text>

          <Section style={infoBox}>
            <Text style={infoLabel}>Valor reembolsado</Text>
            <Text style={infoValueHighlight}>{refundAmount}</Text>

            {originalPenaltyAmount && (
              <>
                <Hr style={hrInner} />
                <Text style={infoLabel}>Multa original</Text>
                <Text style={infoValue}>{originalPenaltyAmount}</Text>
              </>
            )}

            <Hr style={hrInner} />
            <Text style={infoLabel}>Tipo de reembolso</Text>
            <Text style={infoValue}>{isTotal ? 'Total' : 'Parcial'}</Text>

            {processedAt && (
              <>
                <Hr style={hrInner} />
                <Text style={infoLabel}>Processado em</Text>
                <Text style={infoValue}>{processedAt}</Text>
              </>
            )}
          </Section>

          {reason && (
            <Section style={reasonBox}>
              <Text style={reasonLabel}>Motivo informado pelo administrador:</Text>
              <Text style={reasonText}>{reason}</Text>
            </Section>
          )}

          <Text style={text}>
            O valor será creditado de volta no mesmo meio de pagamento usado
            originalmente. Dependendo do seu banco ou administradora do cartão,
            o crédito pode levar de 5 a 10 dias úteis para aparecer na fatura.
          </Text>

          <Text style={text}>
            Se tiver qualquer dúvida sobre este reembolso, é só responder este
            e-mail que nossa equipe vai te ajudar.
          </Text>

          <Hr style={hr} />
          <Text style={footer}>Atenciosamente, equipe {SITE_NAME}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: CommitmentPenaltyRefundedEmail,
  subject: 'Seu reembolso foi processado',
  displayName: 'Reembolso de multa de permanência',
  previewData: {
    name: 'João',
    refundAmount: 'R$ 49,90',
    originalPenaltyAmount: 'R$ 99,80',
    refundType: 'partial',
    reason: 'Cliente comprovou problema de saúde durante o período de compromisso.',
    processedAt: '18/04/2026',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const infoBox = {
  backgroundColor: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '20px 0',
}
const infoLabel = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.4px',
}
const infoValue = { fontSize: '14px', color: '#111827', margin: '0', fontWeight: '500' }
const infoValueHighlight = {
  fontSize: '20px',
  color: '#15803d',
  margin: '0',
  fontWeight: 'bold' as const,
}
const reasonBox = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '14px 18px',
  margin: '16px 0',
}
const reasonLabel = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '0 0 6px',
  fontWeight: '600' as const,
}
const reasonText = { fontSize: '14px', color: '#374151', margin: '0', fontStyle: 'italic' as const }
const hrInner = { borderColor: '#d1fae5', margin: '10px 0' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0 12px' }
const footer = { fontSize: '12px', color: '#6b7280', margin: '0' }
