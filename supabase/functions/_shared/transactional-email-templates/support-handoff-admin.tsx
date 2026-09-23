import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text, Hr, Section, Button } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Revisão Fácil"

interface Props {
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  reason?: string
  lastMessages?: string
  whatsappStatus?: string
  panelUrl?: string
}

const Email = ({ customerName, customerPhone, customerEmail, reason, lastMessages, whatsappStatus, panelUrl }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Cliente aguardando atendimento da equipe — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Cliente aguardando a equipe</Heading>
        <Text style={text}>Um atendimento no site precisa que alguém da equipe continue a conversa.</Text>
        <Section style={card}>
          <Text style={label}>Cliente</Text>
          <Text style={value}>{customerName || '—'}</Text>
          <Text style={label}>Celular</Text>
          <Text style={value}>{customerPhone || '—'}</Text>
          <Text style={label}>E-mail</Text>
          <Text style={value}>{customerEmail || '—'}</Text>
          <Text style={label}>Motivo</Text>
          <Text style={value}>{reason || '—'}</Text>
          <Hr style={hr} />
          <Text style={label}>Últimas mensagens</Text>
          <Text style={messageStyle}>{lastMessages || '—'}</Text>
        </Section>
        {whatsappStatus && <Text style={note}>Aviso pelo WhatsApp: {whatsappStatus}</Text>}
        {panelUrl && <Button href={panelUrl} style={button}>Abrir Atendimento Virtual</Button>}
        <Hr style={hr} />
        <Text style={footer}>Equipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Atendimento aguardando a equipe: ${d?.customerName || 'cliente'}`,
  displayName: 'Atendimento Virtual — cliente aguardando a equipe (admin)',
  previewData: {
    customerName: 'Maria Silva', customerPhone: '(11) 99999-9999', customerEmail: 'maria@example.com',
    reason: 'Pergunta sem resposta cadastrada', lastMessages: '• Posso parcelar o plano anual?',
    whatsappStatus: 'não entregue', panelUrl: 'https://revisaofacil.com.br/admin',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const note = { fontSize: '13px', color: '#6b7280', margin: '0 0 16px' }
const card = { backgroundColor: '#f9fafb', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', margin: '0 0 16px' }
const label = { fontSize: '12px', color: '#6b7280', fontWeight: 'bold' as const, textTransform: 'uppercase' as const, margin: '0 0 4px' }
const value = { fontSize: '14px', color: '#1f2937', margin: '0 0 12px' }
const messageStyle = { fontSize: '14px', color: '#1f2937', whiteSpace: 'pre-wrap' as const, lineHeight: '1.6', margin: '0' }
const button = { backgroundColor: '#dc2626', color: '#ffffff', padding: '12px 20px', borderRadius: '6px', fontSize: '14px', textDecoration: 'none' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }
