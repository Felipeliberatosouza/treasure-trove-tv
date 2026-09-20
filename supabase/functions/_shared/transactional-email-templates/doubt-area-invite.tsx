import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import SignupFooter from './signup-footer.tsx'

const SITE_NAME = "Revisão Fácil"

interface DoubtAreaInviteProps {
  teacherName?: string
  areaName?: string
  subject?: string
  question?: string
  doubtUrl?: string
  bonusText?: string
  unsubscribeUrl?: string
}

const DoubtAreaInviteEmail = ({
  teacherName, areaName, subject, question, doubtUrl, bonusText, unsubscribeUrl,
}: DoubtAreaInviteProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Nova dúvida de aluno na sua área - {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Nova dúvida de aluno esperando resposta</Heading>
        <Text style={text}>Olá{teacherName ? `, ${teacherName}` : ''}!</Text>
        <Text style={text}>
          Um aluno enviou uma dúvida{areaName ? ` na área de ${areaName}` : ''}
          {subject ? ` sobre ${subject}` : ''}. Você pode responder no chat da dúvida —
          outros professores também podem contribuir.
        </Text>
        {question && (
          <>
            <Text style={label}>Dúvida do aluno:</Text>
            <Text style={questionStyle}>"{question}"</Text>
          </>
        )}
        {doubtUrl && (
          <Button href={doubtUrl} style={button}>Responder esta dúvida</Button>
        )}
        {bonusText && <Text style={text}>{bonusText}</Text>}
        <Hr style={hr} />
        <Text style={text}>
          Responder dúvidas soma pontos no seu RF Score. Não é permitido trocar contatos
          (telefone, e-mail ou sites) nem usar linguagem ofensiva dentro do chat.
        </Text>
        <Text style={footer}>Equipe {SITE_NAME}</Text>
        <SignupFooter unsubscribeUrl={unsubscribeUrl} />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DoubtAreaInviteEmail,
  subject: 'Nova dúvida de aluno na sua área',
  displayName: 'Convocação de dúvida (professor)',
  previewData: {
    teacherName: 'Prof. João',
    areaName: 'Farmácia',
    subject: 'Farmacocinética',
    question: 'Qual a diferença entre meia-vida e clearance?',
    doubtUrl: 'https://revisaofacil.com.br/dashboard?tab=duvidas',
    bonusText: 'Esta dúvida tem bônus de R$ 5,00 por resposta aprovada.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const label = { fontSize: '13px', color: '#6b7280', fontWeight: 'bold' as const, margin: '0 0 4px' }
const questionStyle = { fontSize: '14px', color: '#1f2937', fontStyle: 'italic' as const, backgroundColor: '#f9fafb', padding: '12px 16px', borderRadius: '6px', margin: '0 0 16px' }
const button = { backgroundColor: '#dc2626', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, padding: '12px 20px', borderRadius: '6px', textDecoration: 'none', display: 'inline-block', margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }
