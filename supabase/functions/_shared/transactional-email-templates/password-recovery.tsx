import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Revisão Fácil"

interface PasswordRecoveryProps {
  name?: string
  recovery_link?: string
  platform_name?: string
}

const PasswordRecoveryEmail = ({ name, recovery_link, platform_name }: PasswordRecoveryProps) => {
  const platform = platform_name || SITE_NAME
  const link = recovery_link || '#'
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Recuperação de senha - {platform}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Recuperação de Senha 🔐</Heading>
          <Text style={text}>Olá{name ? `, ${name}` : ''},</Text>
          <Text style={text}>
            Recebemos uma solicitação para redefinir a senha da sua conta na <strong>{platform}</strong>.
          </Text>
          <Text style={text}>
            Clique no botão abaixo para criar uma nova senha. Este link expira em <strong>30 minutos</strong>.
          </Text>
          <Container style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={link} style={button}>
              Redefinir minha senha
            </Button>
          </Container>
          <Text style={text}>
            Se o botão não funcionar, copie e cole este endereço no navegador:
          </Text>
          <Text style={linkText}>{link}</Text>
          <Hr style={hr} />
          <Text style={textMuted}>
            Se você não solicitou a recuperação de senha, ignore este e-mail. Sua senha permanece inalterada.
          </Text>
          <Text style={textMuted}>
            Por motivos de segurança, nunca compartilhe este link com terceiros.
          </Text>
          <Text style={footer}>Equipe {platform}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: PasswordRecoveryEmail,
  subject: (data: Record<string, any>) =>
    `Recuperação de senha - ${data?.platform_name || SITE_NAME}`,
  displayName: 'Recuperação de Senha',
  previewData: {
    name: 'Maria',
    recovery_link: 'https://revisaofacil.com.br/reset-password#access_token=...',
    platform_name: SITE_NAME,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const textMuted = { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 8px' }
const linkText = { fontSize: '12px', color: '#6366f1', wordBreak: 'break-all' as const, margin: '0 0 16px' }
const button = {
  backgroundColor: '#6366f1',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: 600,
  display: 'inline-block',
  fontSize: '14px',
}
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '24px 0 0', textAlign: 'center' as const }
