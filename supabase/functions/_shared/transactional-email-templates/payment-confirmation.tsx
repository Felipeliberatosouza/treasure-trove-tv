/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Revisão Fácil'

interface PaymentConfirmationProps {
  name?: string
  planName?: string
  amount?: string
  paymentDate?: string
  dashboardLink?: string
}

const PaymentConfirmationEmail = ({
  name,
  planName = 'Plano',
  amount = '—',
  paymentDate = '',
  dashboardLink = 'https://revisaofacil.com/dashboard/student',
}: PaymentConfirmationProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Pagamento confirmado — {planName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Pagamento confirmado! ✅</Heading>
        <Text style={text}>
          {name ? `Olá, ${name}!` : 'Olá!'}
        </Text>
        <Text style={text}>
          Seu pagamento foi processado com sucesso.
        </Text>
        <Section style={infoBox}>
          <Text style={infoText}><strong>Plano/Item:</strong> {planName}</Text>
          <Text style={infoText}><strong>Valor:</strong> R$ {amount}</Text>
          <Text style={infoText}><strong>Data:</strong> {paymentDate}</Text>
        </Section>
        <Text style={text}>
          Agora você tem acesso completo ao conteúdo contratado. Bons estudos!
        </Text>
        <Button style={button} href={dashboardLink}>
          Ir para o Painel
        </Button>
        <Hr style={hr} />
        <Text style={footer}>Equipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PaymentConfirmationEmail,
  subject: (data: Record<string, any>) =>
    `Confirmação de pagamento${data?.planName ? ` — ${data.planName}` : ''}`,
  displayName: 'Confirmação de pagamento',
  previewData: {
    name: 'João Silva',
    planName: 'Plano Trimestral',
    amount: '89,90',
    paymentDate: '12/04/2026',
    dashboardLink: 'https://revisaofacil.com/dashboard/student',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a2e', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const infoBox = { backgroundColor: '#f8f9fa', borderRadius: '8px', padding: '16px', margin: '0 0 16px' }
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
