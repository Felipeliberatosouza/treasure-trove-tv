import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import SignupFooter from './signup-footer.tsx'

const SITE_NAME = "Revisão Fácil"

interface WelcomeTeacherProps {
  name?: string
  unsubscribeUrl?: string
}

const WelcomeTeacherEmail = ({ name, unsubscribeUrl }: WelcomeTeacherProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Bem-vindo(a) à {SITE_NAME}! 📚</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Bem-vindo(a) à {SITE_NAME}! 📚</Heading>
        <Text style={text}>
          Olá{name ? `, ${name}` : ''}!
        </Text>
        <Text style={text}>
          Sua conta de professor foi criada com sucesso. Agora você pode
          compartilhar suas aulas, revisões e materiais com milhares de alunos.
        </Text>
        <Hr style={hr} />
        <Text style={text}>
          Acesse seu painel de professor para começar a cadastrar seus conteúdos.
        </Text>
        <Text style={footer}>Equipe {SITE_NAME}</Text>
        <SignupFooter unsubscribeUrl={unsubscribeUrl} />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeTeacherEmail,
  subject: 'Bem-vindo(a) à Revisão Fácil! 📚',
  displayName: 'Boas-vindas (Professor)',
  previewData: { name: 'João' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }
