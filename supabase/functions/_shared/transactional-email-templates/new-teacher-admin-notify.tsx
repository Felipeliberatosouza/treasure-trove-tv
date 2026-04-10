import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Revisão Fácil"

interface NewTeacherAdminNotifyProps {
  teacherName?: string
  teacherEmail?: string
}

const NewTeacherAdminNotifyEmail = ({ teacherName, teacherEmail }: NewTeacherAdminNotifyProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Novo professor cadastrado na {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Novo Professor Cadastrado 🎓</Heading>
        <Text style={text}>
          Um novo professor acabou de se cadastrar na plataforma {SITE_NAME}.
        </Text>
        <Text style={text}>
          <strong>Nome:</strong> {teacherName || 'Não informado'}<br />
          <strong>E-mail:</strong> {teacherEmail || 'Não informado'}
        </Text>
        <Hr style={hr} />
        <Text style={text}>
          Acesse o painel administrativo para revisar o novo cadastro.
        </Text>
        <Text style={footer}>Sistema {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewTeacherAdminNotifyEmail,
  subject: 'Novo professor cadastrado na Revisão Fácil',
  displayName: 'Notificação de novo professor (Admin)',
  previewData: { teacherName: 'Maria Silva', teacherEmail: 'maria@email.com' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }
