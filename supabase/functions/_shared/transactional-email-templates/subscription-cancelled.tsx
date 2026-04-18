/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import MarketingFooter from './marketing-footer.tsx'

const SITE_NAME = 'Revisão Fácil'

interface SubscriptionCancelledProps {
  name?: string
  planName?: string
  expiryDate?: string
  reason?: string
  renewLink?: string
  receiptUrl?: string
  proRataSubtotal?: string
  commitmentPenalty?: string
  commitmentDaysRemaining?: number
  minCommitmentDays?: number
  chargeAmount?: string
  unsubscribeUrl?: string
}

const SubscriptionCancelledEmail = ({
  name,
  planName = 'Plano',
  expiryDate = '',
  reason = 'cancelada',
  renewLink = 'https://revisaofacil.com/#pricing',
  receiptUrl,
  proRataSubtotal,
  commitmentPenalty,
  commitmentDaysRemaining,
  minCommitmentDays,
  chargeAmount,
  unsubscribeUrl,
}: SubscriptionCancelledProps) => {
  const hasPenalty = !!commitmentPenalty && (commitmentDaysRemaining ?? 0) > 0
  return (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Sua assinatura foi {reason} — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Assinatura {reason} 😔</Heading>
        <Text style={text}>
          {name ? `Olá, ${name}!` : 'Olá!'}
        </Text>
        <Text style={text}>
          Informamos que sua assinatura do plano <strong>{planName}</strong> foi {reason}.
        </Text>
        {expiryDate && (
          <Section style={infoBox}>
            <Text style={infoText}><strong>Data de encerramento:</strong> {expiryDate}</Text>
            <Text style={infoText}><strong>Plano:</strong> {planName}</Text>
            <Text style={infoText}><strong>Status:</strong> {reason === 'expirada' ? 'Expirada' : 'Cancelada'}</Text>
            {proRataSubtotal && (
              <Text style={infoText}><strong>Subtotal proporcional:</strong> {proRataSubtotal}</Text>
            )}
            {hasPenalty && (
              <Text style={{ ...infoText, color: '#b91c1c' }}>
                <strong>Multa de permanência ({commitmentDaysRemaining} dias restantes de {minCommitmentDays}):</strong> {commitmentPenalty}
              </Text>
            )}
            {chargeAmount && (
              <Text style={{ ...infoText, fontWeight: 'bold' as const, marginTop: '8px' }}>
                <strong>Total cobrado:</strong> {chargeAmount}
              </Text>
            )}
          </Section>
        )}
        <Text style={text}>
          A partir de agora, o acesso aos conteúdos exclusivos do plano está suspenso.
          Você ainda pode acessar conteúdos gratuitos normalmente.
        </Text>
        <Text style={text}>
          Caso queira voltar a ter acesso completo, você pode renovar sua assinatura a qualquer momento:
        </Text>
        <Button style={button} href={renewLink}>
          Renovar Assinatura
        </Button>
        {receiptUrl && (
          <Section style={{ marginTop: '16px' }}>
            <Text style={text}>
              Você também pode baixar o comprovante detalhado do cancelamento (cálculo proporcional, multa de permanência, se houver, e valor total cobrado):
            </Text>
            <Button style={secondaryButton} href={receiptUrl}>
              Baixar comprovante (PDF)
            </Button>
            <Text style={{ ...text, fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
              O link do comprovante expira em 30 dias.
            </Text>
          </Section>
        )}
        <Hr style={hr} />
        <Text style={text}>
          Se tiver dúvidas ou precisar de ajuda, entre em contato conosco.
        </Text>
        <Text style={footer}>Equipe {SITE_NAME}</Text>
        <MarketingFooter unsubscribeUrl={unsubscribeUrl} />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SubscriptionCancelledEmail,
  subject: (data: Record<string, any>) =>
    `Sua assinatura foi ${data?.reason || 'cancelada'} — ${SITE_NAME}`,
  displayName: 'Assinatura cancelada/expirada',
  previewData: {
    name: 'João Silva',
    planName: 'Plano Trimestral',
    expiryDate: '12/04/2026',
    reason: 'cancelada',
    renewLink: 'https://revisaofacil.com/#pricing',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const infoBox = { backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px', margin: '0 0 16px' }
const infoText = { fontSize: '14px', color: '#374151', margin: '0 0 4px' }
const button = {
  backgroundColor: '#dc2626',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '8px',
  textDecoration: 'none' as const,
  fontWeight: '600' as const,
  fontSize: '14px',
  display: 'inline-block' as const,
}
const secondaryButton = {
  backgroundColor: '#374151',
  color: '#ffffff',
  padding: '10px 20px',
  borderRadius: '8px',
  textDecoration: 'none' as const,
  fontWeight: '600' as const,
  fontSize: '13px',
  display: 'inline-block' as const,
}
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }
