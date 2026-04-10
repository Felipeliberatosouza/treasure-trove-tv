import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Revisão Fácil"

interface DoubtAnsweredProps {
  studentName?: string
  question?: string
  answer?: string
  teacherName?: string
}

const DoubtAnsweredEmail = ({ studentName, question, answer, teacherName }: DoubtAnsweredProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Sua dúvida foi respondida - {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Sua dúvida foi respondida!</Heading>
        <Text style={text}>
          Olá{studentName ? `, ${studentName}` : ''}!
        </Text>
        <Text style={text}>
          O professor {teacherName || ''} respondeu sua dúvida.
        </Text>
        {question && (
          <>
            <Text style={label}>Sua pergunta:</Text>
            <Text style={questionStyle}>"{question}"</Text>
          </>
        )}
        {answer && (
          <>
            <Text style={label}>Resposta:</Text>
            <Text style={answerStyle}>{answer}</Text>
          </>
        )}
        <Hr style={hr} />
        <Text style={text}>
          Acesse sua área de aluno para ver a resposta completa.
        </Text>
        <Text style={footer}>Equipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DoubtAnsweredEmail,
  subject: 'Sua dúvida foi respondida!',
  displayName: 'Dúvida respondida (aluno)',
  previewData: { studentName: 'Maria', question: 'Como resolver equações de segundo grau?', answer: 'Você pode usar a fórmula de Bhaskara...', teacherName: 'Prof. João' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const label = { fontSize: '13px', color: '#6b7280', fontWeight: 'bold' as const, margin: '0 0 4px' }
const questionStyle = { fontSize: '14px', color: '#1f2937', fontStyle: 'italic' as const, backgroundColor: '#f9fafb', padding: '12px 16px', borderRadius: '6px', margin: '0 0 16px' }
const answerStyle = { fontSize: '14px', color: '#1f2937', backgroundColor: '#f0fdf4', padding: '12px 16px', borderRadius: '6px', margin: '0 0 16px', borderLeft: '4px solid #22c55e' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }
