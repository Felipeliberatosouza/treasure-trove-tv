import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import SignupFooter from './signup-footer.tsx'

const SITE_NAME = "Revisão Fácil"

interface DoubtNewAnswerProps {
  studentName?: string
  teacherName?: string
  question?: string
  answer?: string
  doubtUrl?: string
  unsubscribeUrl?: string
}

const DoubtNewAnswerEmail = ({
  studentName, teacherName, question, answer, doubtUrl, unsubscribeUrl,
}: DoubtNewAnswerProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Um professor respondeu sua dúvida - {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Um professor respondeu sua dúvida!</Heading>
        <Text style={text}>Olá{studentName ? `, ${studentName}` : ''}!</Text>
        <Text style={text}>
          {teacherName ? `${teacherName} ` : 'Um professor '}
          acabou de responder no chat da sua dúvida. Outros professores ainda podem
          complementar a resposta.
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
        {doubtUrl && <Button href={doubtUrl} style={button}>Ver o chat da dúvida</Button>}
        <Hr style={hr} />
        <Text style={footer}>Equipe {SITE_NAME}</Text>
        <SignupFooter unsubscribeUrl={unsubscribeUrl} />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DoubtNewAnswerEmail,
  subject: 'Um professor respondeu sua dúvida!',
  displayName: 'Nova resposta no chat de dúvidas (aluno)',
  previewData: {
    studentName: 'Maria',
    teacherName: 'Prof. João',
    question: 'Qual a diferença entre meia-vida e clearance?',
    answer: 'Meia-vida é o tempo para a concentração cair pela metade...',
    doubtUrl: 'https://revisaofacil.com.br/minhas-duvidas',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const label = { fontSize: '13px', color: '#6b7280', fontWeight: 'bold' as const, margin: '0 0 4px' }
const questionStyle = { fontSize: '14px', color: '#1f2937', fontStyle: 'italic' as const, backgroundColor: '#f9fafb', padding: '12px 16px', borderRadius: '6px', margin: '0 0 16px' }
const answerStyle = { fontSize: '14px', color: '#1f2937', backgroundColor: '#f0fdf4', padding: '12px 16px', borderRadius: '6px', margin: '0 0 16px', borderLeft: '4px solid #22c55e' }
const button = { backgroundColor: '#dc2626', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, padding: '12px 20px', borderRadius: '6px', textDecoration: 'none', display: 'inline-block', margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }
