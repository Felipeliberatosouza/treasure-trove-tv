import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Revisão Fácil"

interface ContentEditedAdminNotifyProps {
  teacherName?: string
  teacherEmail?: string
  contentTitle?: string
  contentType?: string
}

const ContentEditedAdminNotifyEmail = ({ teacherName, teacherEmail, contentTitle, contentType }: ContentEditedAdminNotifyProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Conteúdo aprovado editado por professor na {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Conteúdo Aprovado Editado ✏️</Heading>
        <Text style={text}>
          Um professor editou um conteúdo que já estava aprovado. O conteúdo voltou para pendência de aprovação.
        </Text>
        <Text style={text}>
          <strong>Professor:</strong> {teacherName || 'Não informado'}<br />
          <strong>E-mail:</strong> {teacherEmail || 'Não informado'}<br />
          <strong>Conteúdo:</strong> {contentTitle || 'Sem título'}<br />
          <strong>Tipo:</strong> {contentType === 'lessons' ? 'Aula / Revisão' : 'Resolução de Prova'}
        </Text>
        <Hr style={hr} />
        <Text style={text}>
          Acesse o painel administrativo para revisar as alterações e reaprovar o conteúdo.
        </Text>
        <Text style={footer}>Sistema {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContentEditedAdminNotifyEmail,
  subject: 'Conteúdo aprovado editado por professor',
  displayName: 'Notificação de edição de conteúdo aprovado (Admin)',
  previewData: { teacherName: 'Maria Silva', teacherEmail: 'maria@email.com', contentTitle: 'Revisão de Cálculo I', contentType: 'lessons' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }
