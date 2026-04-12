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
  unsubscribeUrl?: string
}

const SubscriptionCancelledEmail = ({
  name,
  planName = 'Plano',
  expiryDate = '',
  reason = 'cancelada',
  renewLink = 'https://revisaofacil.com/#pricing',
  unsubscribeUrl,
}: SubscriptionCancelledProps) => (
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
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a2e', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const infoBox = { backgroundColor: '#fef2f2', borderRadius: '8px', padding: '16px', margin: '0 0 16px' }
const infoText = { fontSize: '14px', color: '#333333', margin: '0 0 4px' }
const button = {
  backgroundColor: '#6366f1',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '8px',
  textDecoration: 'none' as const,
  fontWeight: '600' as const,
  fontSize: '14px',
  display: 'inline-block' as const,
}
const hr = { borderTop: '1px solid #e5e7eb', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
