/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import SignupFooter from './signup-footer.tsx'

const SITE_NAME = 'Revisão Fácil'

interface TeacherPaymentPaidProps {
  name?: string
  periodStart?: string
  periodEnd?: string
  paymentType?: string
  grossAmount?: string
  platformFee?: string
  netAmount?: string
  pixKey?: string
  notes?: string
  statementLink?: string
  unsubscribeUrl?: string
}

const TeacherPaymentPaidEmail = ({
  name,
  periodStart = '',
  periodEnd = '',
  paymentType = 'Assinatura',
  grossAmount = '0,00',
  platformFee = '0,00',
  netAmount = '0,00',
  pixKey = '',
  notes = '',
  statementLink = 'https://revisaofacil.com/dashboard/teacher?tab=sales',
  unsubscribeUrl,
}: TeacherPaymentPaidProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu pagamento foi efetuado — R$ {netAmount}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Pagamento efetuado! 💸</Heading>
        <Text style={text}>
          {name ? `Olá, ${name}!` : 'Olá, professor(a)!'}
        </Text>
        <Text style={text}>
          Seu pagamento referente ao período abaixo foi marcado como <strong>Pago</strong>.
        </Text>

        <Section style={infoBox}>
          <Text style={infoText}><strong>Período:</strong> {periodStart} a {periodEnd}</Text>
          <Text style={infoText}><strong>Tipo:</strong> {paymentType}</Text>
          <Text style={infoText}><strong>Valor bruto:</strong> R$ {grossAmount}</Text>
          <Text style={infoText}><strong>Taxa da plataforma:</strong> R$ {platformFee}</Text>
          <Text style={infoTextHighlight}><strong>Valor líquido recebido:</strong> R$ {netAmount}</Text>
          {pixKey ? (
            <Text style={infoText}><strong>Chave PIX:</strong> {pixKey}</Text>
          ) : null}
          {notes ? (
            <Text style={infoText}><strong>Observações:</strong> {notes}</Text>
          ) : null}
        </Section>

        <Text style={text}>
          O valor já foi enviado para a sua chave PIX cadastrada. Caso não receba em até 1 dia útil,
          entre em contato com o suporte.
        </Text>

        <Button style={button} href={statementLink}>
          Ver Meu Extrato
        </Button>

        <Hr style={hr} />
        <Text style={footer}>Equipe {SITE_NAME}</Text>
        <SignupFooter unsubscribeUrl={unsubscribeUrl} />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TeacherPaymentPaidEmail,
  subject: (data: Record<string, any>) =>
    `Pagamento efetuado${data?.netAmount ? ` — R$ ${data.netAmount}` : ''}`,
  displayName: 'Pagamento ao professor efetuado',
  previewData: {
    name: 'Maria Souza',
    periodStart: '01/03/2026',
    periodEnd: '31/03/2026',
    paymentType: 'Assinatura',
    grossAmount: '1.250,00',
    platformFee: '125,00',
    netAmount: '1.125,00',
    pixKey: 'maria@email.com',
    notes: 'Referente a março/2026.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const infoBox = { backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px', margin: '0 0 16px' }
const infoText = { fontSize: '14px', color: '#374151', margin: '0 0 4px' }
const infoTextHighlight = { fontSize: '15px', color: '#16a34a', margin: '8px 0 4px', fontWeight: '600' as const }
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
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }
