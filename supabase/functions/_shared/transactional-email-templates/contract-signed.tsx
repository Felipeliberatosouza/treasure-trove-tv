import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import SignupFooter from './signup-footer.tsx'

const SITE_NAME = "Revisão Fácil"

interface ContractSignedProps {
  name?: string
  signedAt?: string
  expiresAt?: string
  ipAddress?: string
  deviceInfo?: string
  cpf?: string
  contractText?: string
  unsubscribeUrl?: string
}

const ContractSignedEmail = ({ name, signedAt, expiresAt, ipAddress, deviceInfo, cpf, contractText, unsubscribeUrl }: ContractSignedProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu contrato com a {SITE_NAME} foi assinado com sucesso ✅</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Contrato Assinado com Sucesso ✅</Heading>
        <Text style={text}>
          Olá{name ? `, ${name}` : ''}!
        </Text>
        <Text style={text}>
          Seu contrato de prestação de serviços com a {SITE_NAME} foi assinado digitalmente com sucesso.
        </Text>

        <Section style={infoBox}>
          <Text style={infoTitle}>Dados da Assinatura</Text>
          {signedAt && <Text style={infoText}>📅 Data/Hora: {signedAt}</Text>}
          {expiresAt && <Text style={infoText}>📆 Validade: {expiresAt}</Text>}
          {cpf && <Text style={infoText}>🆔 CPF: {cpf}</Text>}
          {ipAddress && <Text style={infoText}>🌐 IP: {ipAddress}</Text>}
          {deviceInfo && <Text style={infoText}>📱 Dispositivo: {deviceInfo}</Text>}
        </Section>

        <Hr style={hr} />

        <Text style={sectionTitle}>📄 Cópia do Contrato</Text>
        <Section style={contractBox}>
          <Text style={contractTextStyle}>{contractText || 'Texto do contrato não disponível.'}</Text>
        </Section>

        <Hr style={hr} />

        <Text style={text}>
          Guarde este e-mail como comprovante da sua assinatura digital. Você também pode visualizar
          e baixar o contrato a qualquer momento no seu painel de professor.
        </Text>

        <Text style={footer}>Equipe {SITE_NAME}</Text>
        <SignupFooter unsubscribeUrl={unsubscribeUrl} />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContractSignedEmail,
  subject: 'Contrato assinado com sucesso — Revisão Fácil',
  displayName: 'Contrato assinado (Professor)',
  previewData: {
    name: 'João Silva',
    signedAt: '12/04/2026 às 14:30:00',
    expiresAt: '12/04/2027',
    ipAddress: '192.168.1.1',
    deviceInfo: 'Chrome / Windows',
    cpf: '***.***.***-00',
    contractText: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS...',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }
const infoBox = { backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px', margin: '0 0 16px' }
const infoTitle = { fontSize: '14px', fontWeight: 'bold' as const, color: '#1f2937', margin: '0 0 8px' }
const infoText = { fontSize: '13px', color: '#4b5563', margin: '0 0 4px', lineHeight: '1.5' }
const sectionTitle = { fontSize: '15px', fontWeight: 'bold' as const, color: '#1f2937', margin: '0 0 8px' }
const contractBox = { backgroundColor: '#f3f4f6', borderRadius: '8px', padding: '16px', border: '1px solid #e5e7eb' }
const contractTextStyle = { fontSize: '12px', color: '#374151', lineHeight: '1.6', margin: '0', whiteSpace: 'pre-line' as const }
