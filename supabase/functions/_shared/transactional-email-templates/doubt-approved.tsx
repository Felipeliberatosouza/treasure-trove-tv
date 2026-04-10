import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Revisão Fácil"

interface DoubtApprovedProps {
  teacherName?: string
  question?: string
  deadlineDays?: number
  studentName?: string
}

const DoubtApprovedEmail = ({ teacherName, question, deadlineDays, studentName }: DoubtApprovedProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Nova dúvida de aluno para responder - {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Nova dúvida recebida</Heading>
        <Text style={text}>
          Olá{teacherName ? `, ${teacherName}` : ''}!
        </Text>
        <Text style={text}>
          Uma nova dúvida de {studentName || 'um aluno'} foi aprovada e está aguardando sua resposta.
        </Text>
        {question && (
          <>
            <Hr style={hr} />
            <Text style={questionStyle}>"{question}"</Text>
            <Hr style={hr} />
          </>
        )}
        <Text style={text}>
          Prazo para resposta: <strong>{deadlineDays || 3} dias</strong>.
        </Text>
        <Text style={text}>
          Acesse sua área de professor para responder.
        </Text>
        <Text style={footer}>Equipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DoubtApprovedEmail,
  subject: 'Nova dúvida de aluno aguardando resposta',
  displayName: 'Dúvida aprovada (professor)',
  previewData: { teacherName: 'João', question: 'Como resolver equações de segundo grau?', deadlineDays: 3, studentName: 'Maria' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const questionStyle = { fontSize: '15px', color: '#1f2937', fontStyle: 'italic' as const, backgroundColor: '#f9fafb', padding: '12px 16px', borderRadius: '6px', margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }
