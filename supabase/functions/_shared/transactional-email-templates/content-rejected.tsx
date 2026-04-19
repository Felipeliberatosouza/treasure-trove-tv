import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import SignupFooter from './signup-footer.tsx'

const SITE_NAME = "Revisão Fácil"

interface ContentRejectedProps {
  teacherName?: string
  contentTitle?: string
  contentType?: string
  rejectionReason?: string
  unsubscribeUrl?: string
}

const ContentRejectedEmail = ({ teacherName, contentTitle, contentType, rejectionReason, unsubscribeUrl }: ContentRejectedProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu conteúdo precisa de ajustes - {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Conteúdo não aprovado</Heading>
        <Text style={text}>
          Olá{teacherName ? `, ${teacherName}` : ''}!
        </Text>
        <Text style={text}>
          Infelizmente, seu conteúdo não foi aprovado nesta revisão. Por favor, verifique as observações abaixo.
        </Text>
        <Hr style={hr} />
        <Text style={contentBox}>
          <strong>{contentType === 'exam_solution' ? 'Resolução' : 'Aula'}:</strong> {contentTitle || 'Sem título'}
        </Text>
        {rejectionReason && (
          <>
            <Text style={reasonLabel}>Observação do administrador:</Text>
            <Text style={reasonBox}>{rejectionReason}</Text>
          </>
        )}
        <Hr style={hr} />
        <Text style={text}>
          Você pode editar e reenviar o conteúdo para uma nova análise. Se tiver dúvidas sobre os critérios de aprovação, entre em contato conosco.
        </Text>
        <Text style={footer}>Equipe {SITE_NAME}</Text>
        <SignupFooter unsubscribeUrl={unsubscribeUrl} />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContentRejectedEmail,
  subject: (data: Record<string, any>) => `Seu conteúdo "${data.contentTitle || ''}" precisa de ajustes`,
  displayName: 'Conteúdo rejeitado (professor)',
  previewData: { teacherName: 'João', contentTitle: 'É nois!', contentType: 'lesson', rejectionReason: 'O vídeo possui trechos com áudio inaudível e a resolução está incompleta no minuto 3:45.' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const contentBox = { fontSize: '15px', color: '#1f2937', backgroundColor: '#fef2f2', padding: '12px 16px', borderRadius: '6px', margin: '0 0 16px' }
const reasonLabel = { fontSize: '13px', fontWeight: 'bold' as const, color: '#374151', margin: '0 0 4px' }
const reasonBox = { fontSize: '14px', color: '#991b1b', backgroundColor: '#fef2f2', padding: '12px 16px', borderRadius: '6px', borderLeft: '4px solid #dc2626', margin: '0 0 16px', lineHeight: '1.6' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }
