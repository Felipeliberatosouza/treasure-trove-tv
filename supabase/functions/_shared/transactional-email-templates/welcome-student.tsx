import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Revisão Fácil"

interface WelcomeStudentProps {
  name?: string
}

const WelcomeStudentEmail = ({ name }: WelcomeStudentProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Bem-vindo(a) à {SITE_NAME}! 🎓</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Bem-vindo(a) à {SITE_NAME}! 🎓</Heading>
        <Text style={text}>
          Olá{name ? `, ${name}` : ''}!
        </Text>
        <Text style={text}>
          Sua conta de aluno foi criada com sucesso. Agora você tem acesso a
          revisões, resumos, simulados e muito mais para turbinar seus estudos.
        </Text>
        <Hr style={hr} />
        <Text style={text}>
          Explore os conteúdos disponíveis e comece a aprender agora mesmo!
        </Text>
        <Text style={footer}>Equipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeStudentEmail,
  subject: 'Bem-vindo(a) à Revisão Fácil! 🎓',
  displayName: 'Boas-vindas (Aluno)',
  previewData: { name: 'Maria' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }
