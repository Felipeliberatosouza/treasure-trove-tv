import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import MarketingFooter from './marketing-footer.tsx'

const SITE_NAME = "Revisão Fácil"

interface ContentApprovedProps {
  teacherName?: string
  contentTitle?: string
  contentType?: string
  unsubscribeUrl?: string
}

const ContentApprovedEmail = ({ teacherName, contentTitle, contentType, unsubscribeUrl }: ContentApprovedProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu conteúdo foi aprovado! - {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>🎉 Conteúdo aprovado!</Heading>
        <Text style={text}>
          Olá{teacherName ? `, ${teacherName}` : ''}!
        </Text>
        <Text style={text}>
          Temos boas notícias! Seu conteúdo foi aprovado e já está publicado na plataforma.
        </Text>
        <Hr style={hr} />
        <Text style={contentBox}>
          <strong>{contentType === 'exam_solution' ? 'Resolução' : 'Aula'}:</strong> {contentTitle || 'Sem título'}
        </Text>
        <Hr style={hr} />
        <Text style={text}>
          Seu conteúdo já está disponível para os alunos. Continue produzindo conteúdos de qualidade!
        </Text>
        <Text style={footer}>Equipe {SITE_NAME}</Text>
        <MarketingFooter unsubscribeUrl={unsubscribeUrl} />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContentApprovedEmail,
  subject: (data: Record<string, any>) => `Seu conteúdo "${data.contentTitle || ''}" foi aprovado!`,
  displayName: 'Conteúdo aprovado (professor)',
  previewData: { teacherName: 'João', contentTitle: 'É nois!', contentType: 'lesson' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const contentBox = { fontSize: '15px', color: '#1f2937', backgroundColor: '#f9fafb', padding: '12px 16px', borderRadius: '6px', margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }
