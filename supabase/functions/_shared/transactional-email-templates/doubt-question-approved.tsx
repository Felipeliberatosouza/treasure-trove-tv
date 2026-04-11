import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Revisão Fácil"

interface DoubtQuestionApprovedProps {
  studentName?: string
  question?: string
}

const DoubtQuestionApprovedEmail = ({ studentName, question }: DoubtQuestionApprovedProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Sua dúvida foi aprovada - {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Sua dúvida foi aprovada!</Heading>
        <Text style={text}>
          Olá{studentName ? `, ${studentName}` : ''}!
        </Text>
        <Text style={text}>
          Sua dúvida foi analisada e aprovada pela nossa equipe. O professor já foi notificado e irá responder em breve.
        </Text>
        {question && (
          <>
            <Text style={label}>Sua pergunta:</Text>
            <Text style={questionStyle}>"{question}"</Text>
          </>
        )}
        <Hr style={hr} />
        <Text style={text}>
          Te avisaremos por e-mail assim que a resposta estiver disponível. Fique de olho! 📚
        </Text>
        <Text style={footer}>Equipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DoubtQuestionApprovedEmail,
  subject: 'Sua dúvida foi aprovada!',
  displayName: 'Dúvida aprovada (aluno)',
  previewData: { studentName: 'Maria', question: 'Como resolver equações de segundo grau?' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const label = { fontSize: '13px', color: '#6b7280', fontWeight: 'bold' as const, margin: '0 0 4px' }
const questionStyle = { fontSize: '14px', color: '#1f2937', fontStyle: 'italic' as const, backgroundColor: '#f9fafb', padding: '12px 16px', borderRadius: '6px', margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }
