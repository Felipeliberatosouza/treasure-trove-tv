import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Revisão Fácil"

interface SuspiciousLoginAdminNotifyProps {
  suspectEmail?: string
  failedCount?: number
  isBlocked?: boolean
}

const SuspiciousLoginAdminNotifyEmail = ({ suspectEmail, failedCount, isBlocked }: SuspiciousLoginAdminNotifyProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>⚠️ Atividade suspeita de login detectada na {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={alertBanner}>
          <Text style={alertIcon}>⚠️</Text>
          <Text style={alertText}>Alerta de Segurança</Text>
        </Section>
        <Heading style={h1}>Atividade Suspeita de Login</Heading>
        <Text style={text}>
          Foram detectadas múltiplas tentativas de login falhadas na plataforma {SITE_NAME}.
        </Text>
        <Section style={detailsBox}>
          <Text style={detailLabel}>E-mail alvo:</Text>
          <Text style={detailValue}>{suspectEmail || 'Desconhecido'}</Text>
          <Text style={detailLabel}>Tentativas falhadas:</Text>
          <Text style={detailValue}>{failedCount ?? '—'}</Text>
          <Text style={detailLabel}>Status:</Text>
          <Text style={detailValue}>
            {isBlocked ? '🔒 Login bloqueado automaticamente (15 min)' : '⚠️ Em observação'}
          </Text>
        </Section>
        <Hr style={hr} />
        <Text style={text}>
          Recomendamos verificar os logs de tentativas de login no painel administrativo para mais detalhes.
        </Text>
        <Text style={footer}>Sistema de Segurança — {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SuspiciousLoginAdminNotifyEmail,
  subject: '⚠️ Alerta: Atividade suspeita de login detectada',
  displayName: 'Alerta de login suspeito (Admin)',
  previewData: { suspectEmail: 'usuario@email.com', failedCount: 5, isBlocked: true },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const alertBanner = { backgroundColor: '#fef2f2', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', textAlign: 'center' as const }
const alertIcon = { fontSize: '28px', margin: '0 0 4px' }
const alertText = { fontSize: '14px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const detailsBox = { backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px', marginBottom: '16px', border: '1px solid #e5e7eb' }
const detailLabel = { fontSize: '12px', color: '#6b7280', margin: '0 0 2px', fontWeight: 'bold' as const, textTransform: 'uppercase' as const }
const detailValue = { fontSize: '14px', color: '#111827', margin: '0 0 12px' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }
