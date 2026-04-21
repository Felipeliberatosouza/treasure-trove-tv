import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Revisão Fácil"

interface ContactMessageProps {
  senderName?: string
  senderEmail?: string
  subject?: string
  message?: string
  receivedAt?: string
}

const ContactMessageEmail = ({
  senderName,
  senderEmail,
  subject,
  message,
  receivedAt,
}: ContactMessageProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Nova mensagem do formulário de contato — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Nova mensagem de contato</Heading>
        <Text style={text}>
          Você recebeu uma nova mensagem pelo formulário de Contato do site {SITE_NAME}.
        </Text>

        <Section style={card}>
          <Text style={label}>Nome</Text>
          <Text style={value}>{senderName || '—'}</Text>

          <Text style={label}>E-mail</Text>
          <Text style={value}>{senderEmail || '—'}</Text>

          <Text style={label}>Assunto</Text>
          <Text style={value}>{subject || '—'}</Text>

          {receivedAt && (
            <>
              <Text style={label}>Recebida em</Text>
              <Text style={value}>{receivedAt}</Text>
            </>
          )}

          <Hr style={hr} />

          <Text style={label}>Mensagem</Text>
          <Text style={messageStyle}>{message || '—'}</Text>
        </Section>

        <Text style={text}>
          Para responder, basta enviar um e-mail diretamente para{' '}
          <strong>{senderEmail || 'o remetente'}</strong>.
        </Text>

        <Hr style={hr} />
        <Text style={footer}>Equipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContactMessageEmail,
  subject: (data: Record<string, any>) =>
    `Contato: ${data?.subject || 'Nova mensagem'}`,
  displayName: 'Mensagem do formulário de Contato (admin)',
  previewData: {
    senderName: 'Maria Silva',
    senderEmail: 'maria@example.com',
    subject: 'Dúvida sobre o plano anual',
    message: 'Olá, gostaria de saber se posso parcelar o plano anual em 12 vezes.',
    receivedAt: '21/04/2026 14:32',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: '#f9fafb', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', margin: '0 0 16px' }
const label = { fontSize: '12px', color: '#6b7280', fontWeight: 'bold' as const, textTransform: 'uppercase' as const, margin: '0 0 4px' }
const value = { fontSize: '14px', color: '#1f2937', margin: '0 0 12px' }
const messageStyle = { fontSize: '14px', color: '#1f2937', whiteSpace: 'pre-wrap' as const, lineHeight: '1.6', margin: '0' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }