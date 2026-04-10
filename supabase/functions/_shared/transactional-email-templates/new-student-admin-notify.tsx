import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Revisão Fácil"

interface NewStudentAdminNotifyProps {
  studentName?: string
  studentEmail?: string
}

const NewStudentAdminNotifyEmail = ({ studentName, studentEmail }: NewStudentAdminNotifyProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Novo aluno cadastrado na {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Novo Aluno Cadastrado 🎉</Heading>
        <Text style={text}>
          Um novo aluno acabou de se cadastrar na plataforma {SITE_NAME}.
        </Text>
        <Text style={text}>
          <strong>Nome:</strong> {studentName || 'Não informado'}<br />
          <strong>E-mail:</strong> {studentEmail || 'Não informado'}
        </Text>
        <Hr style={hr} />
        <Text style={text}>
          Acesse o painel administrativo para mais detalhes.
        </Text>
        <Text style={footer}>Sistema {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewStudentAdminNotifyEmail,
  subject: 'Novo aluno cadastrado na Revisão Fácil',
  displayName: 'Notificação de novo aluno (Admin)',
  previewData: { studentName: 'Ana Costa', studentEmail: 'ana@email.com' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }
