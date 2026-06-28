import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Revisão Fácil'

interface PasswordChangedAdminProps {
  name?: string
  platform_name?: string
  support_email?: string
  support_whatsapp?: string
  changed_at?: string
}

const PasswordChangedAdminEmail = ({
  name,
  platform_name,
  support_email,
  support_whatsapp,
  changed_at,
}: PasswordChangedAdminProps) => {
  const platform = platform_name || SITE_NAME
  const supportMail = support_email || 'contato@revisaofacil.com.br'
  const whatsapp = support_whatsapp || ''
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Sua senha foi alterada - {platform}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Sua senha foi alterada 🔐</Heading>
          <Text style={text}>Olá{name ? `, ${name}` : ''},</Text>
          <Text style={text}>
            Informamos que a senha da sua conta na <strong>{platform}</strong> foi
            alterada{changed_at ? ` em ${changed_at}` : ''} pela nossa equipe de suporte.
          </Text>
          <Text style={text}>
            <strong>Se você solicitou essa alteração</strong>, você já pode acessar
            sua conta normalmente com a nova senha informada pelo suporte. Recomendamos
            que altere a senha em seguida, em um momento privado.
          </Text>
          <Hr style={hr} />
          <Text style={textAlert}>
            ⚠️ Se você <strong>NÃO solicitou</strong> essa alteração, entre em contato
            imediatamente com o suporte da {platform} por questões de segurança:
          </Text>
          <Text style={text}>
            • E-mail: <a href={`mailto:${supportMail}`} style={linkStyle}>{supportMail}</a>
          </Text>
          {whatsapp ? (
            <Text style={text}>
              • WhatsApp:{' '}
              <a href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`} style={linkStyle}>
                {whatsapp}
              </a>
            </Text>
          ) : null}
          <Container style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={`mailto:${supportMail}`} style={button}>
              Falar com o suporte
            </Button>
          </Container>
          <Hr style={hr} />
          <Text style={textMuted}>
            Esta é uma notificação automática de segurança. Por favor, não compartilhe
            sua senha com ninguém.
          </Text>
          <Text style={footer}>Equipe {platform}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: PasswordChangedAdminEmail,
  subject: (data: Record<string, any>) =>
    `Sua senha foi alterada - ${data?.platform_name || SITE_NAME}`,
  displayName: 'Senha alterada pelo suporte',
  previewData: {
    name: 'Maria',
    platform_name: SITE_NAME,
    support_email: 'contato@revisaofacil.com.br',
    support_whatsapp: '5511913258668',
    changed_at: '28/06/2026 às 07:54',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const textAlert = { fontSize: '14px', color: '#b45309', lineHeight: '1.6', margin: '0 0 16px', fontWeight: 600 }
const textMuted = { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 8px' }
const linkStyle = { color: '#6366f1', textDecoration: 'underline' }
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