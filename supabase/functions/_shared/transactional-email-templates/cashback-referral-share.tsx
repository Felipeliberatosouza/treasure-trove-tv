import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Button, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import SignupFooter from './signup-footer.tsx'

const SITE_NAME = "Revisão Fácil"

interface CashbackReferralShareProps {
  name?: string
  referralCode?: string
  referralLink?: string
  shareText?: string
  referralPercent?: number
  unsubscribeUrl?: string
}

const CashbackReferralShareEmail = ({
  name,
  referralCode,
  referralLink,
  shareText,
  referralPercent,
  unsubscribeUrl,
}: CashbackReferralShareProps) => {
  const code = referralCode ?? '—'
  const link = referralLink ?? ''
  const text =
    shareText ??
    `Estou estudando na ${SITE_NAME} e curtindo demais! Use meu link e ganhe acesso aos conteúdos: ${link}`

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Seu link de indicação da {SITE_NAME} está pronto para compartilhar</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Pronto para indicar amigos? 🎁</Heading>
          <Text style={paragraph}>
            Olá{name ? `, ${name}` : ''}! Aqui está tudo que você precisa para
            convidar amigos para a {SITE_NAME}. A cada amigo que fizer a
            primeira compra usando seu código ou link, você ganha{' '}
            <strong>{referralPercent ?? 10}% de cashback</strong> sobre o valor.
          </Text>

          <Hr style={hr} />

          <Text style={label}>Seu código de indicação</Text>
          <Section style={codeBox}>
            <Text style={codeText}>{code}</Text>
          </Section>

          <Text style={label}>Seu link de indicação</Text>
          <Section style={linkBox}>
            <Text style={linkText}>{link}</Text>
          </Section>

          {link && (
            <Section style={{ textAlign: 'center', margin: '24px 0' }}>
              <Button href={link} style={button}>
                Abrir meu link
              </Button>
            </Section>
          )}

          <Hr style={hr} />

          <Text style={label}>Texto pronto para compartilhar</Text>
          <Section style={shareBox}>
            <Text style={shareTextStyle}>{text}</Text>
          </Section>
          <Text style={hint}>
            Copie e cole no WhatsApp, Instagram, e-mail ou onde preferir.
          </Text>

          <Text style={footer}>Equipe {SITE_NAME}</Text>
          <SignupFooter unsubscribeUrl={unsubscribeUrl} />
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: CashbackReferralShareEmail,
  subject: 'Seu link de indicação da Revisão Fácil 🎁',
  displayName: 'Link de indicação (Cashback)',
  previewData: {
    name: 'Maria',
    referralCode: 'A7F9K2X3',
    referralLink: 'https://revisaofacil.com.br/signup-aluno?ref=A7F9K2X3',
    referralPercent: 10,
    shareText:
      'Estou estudando na Revisão Fácil e curtindo demais! Use meu link e ganhe acesso: https://revisaofacil.com.br/signup-aluno?ref=A7F9K2X3',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const paragraph = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const label = { fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', margin: '16px 0 6px' }
const codeBox = { backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '14px', textAlign: 'center' as const }
const codeText = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', letterSpacing: '4px', margin: 0, fontFamily: 'monospace' }
const linkBox = { backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px' }
const linkText = { fontSize: '13px', color: '#374151', margin: 0, wordBreak: 'break-all' as const }
const shareBox = { backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px' }
const shareTextStyle = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' as const }
const button = { backgroundColor: '#dc2626', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' as const }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const hint = { fontSize: '12px', color: '#6b7280', margin: '8px 0 0', fontStyle: 'italic' as const }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }