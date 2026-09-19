import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Button, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import SignupFooter from './signup-footer.tsx'

const SITE_NAME = 'Revisão Fácil'

interface ReferralAccessInviteProps {
  referrer_name?: string
  invite_link?: string
  message?: string
  platform_name?: string
  unsubscribeUrl?: string
}

const ReferralAccessInviteEmail = ({
  referrer_name,
  invite_link,
  message,
  platform_name,
  unsubscribeUrl,
}: ReferralAccessInviteProps) => {
  const platform = platform_name || SITE_NAME
  const friend = referrer_name || 'Um amigo'
  const link = invite_link || ''

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{`${friend} te convidou para estudar na ${platform}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Você recebeu um convite 🎁</Heading>
          <Text style={paragraph}>
            Olá! <strong>{friend}</strong> te convidou para estudar na {platform}:
            revisões, resumos, simulados, top questões, colinhas e aulas com
            professores em um só lugar.
          </Text>

          {message && (
            <Section style={shareBox}>
              <Text style={shareTextStyle}>{message}</Text>
            </Section>
          )}

          <Hr style={hr} />

          <Text style={paragraph}>
            Clique no botão abaixo para acessar pelo convite e criar a sua conta.
            O link é exclusivo para você.
          </Text>

          {link && (
            <Section style={{ textAlign: 'center', margin: '24px 0' }}>
              <Button href={link} style={button}>
                Acessar meu convite
              </Button>
            </Section>
          )}

          {link && (
            <Section style={linkBox}>
              <Text style={linkText}>{link}</Text>
            </Section>
          )}

          <Text style={footer}>Equipe {platform}</Text>
          <SignupFooter unsubscribeUrl={unsubscribeUrl} />
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ReferralAccessInviteEmail,
  subject: 'Você foi convidado para estudar na Revisão Fácil 🎁',
  displayName: 'Convite de indicação (para o amigo indicado)',
  previewData: {
    referrer_name: 'Maria',
    platform_name: 'Revisão Fácil',
    invite_link: 'https://revisaofacil.com.br/convite/ABC123',
    message:
      'Maria te convidou para estudar na Revisão Fácil! Acesse pelo link: https://revisaofacil.com.br/convite/ABC123',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const paragraph = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const linkBox = { backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px' }
const linkText = { fontSize: '13px', color: '#374151', margin: 0, wordBreak: 'break-all' as const }
const shareBox = { backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '14px' }
const shareTextStyle = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' as const }
const button = { backgroundColor: '#dc2626', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' as const }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }
