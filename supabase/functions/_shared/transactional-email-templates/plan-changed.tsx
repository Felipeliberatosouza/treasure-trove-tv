/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import SignupFooter from './signup-footer.tsx'

const SITE_NAME = 'Revisão Fácil'

interface PlanChangedProps {
  name?: string
  previousPlan?: string
  newPlan?: string
  changeType?: string
  proRataAmount?: string
  proRataExplanation?: string
  effectiveDate?: string
  /** New: balance summary fields */
  daysUsed?: number
  daysRemaining?: number
  totalDays?: number
  creditAmount?: string
  newProRataAmount?: string
  balanceLabel?: string
  balanceType?: 'charge' | 'credit' | 'none'
  dashboardLink?: string
  unsubscribeUrl?: string
}

const PlanChangedEmail = ({
  name,
  previousPlan = 'Plano Anterior',
  newPlan = 'Novo Plano',
  changeType = 'upgrade',
  proRataAmount = '—',
  proRataExplanation = '',
  effectiveDate = '',
  daysUsed,
  daysRemaining,
  totalDays = 30,
  creditAmount,
  newProRataAmount,
  balanceLabel,
  balanceType = 'charge',
  dashboardLink = 'https://revisaofacil.com.br/dashboard/student',
  unsubscribeUrl,
}: PlanChangedProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu plano foi alterado — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {changeType === 'upgrade' ? 'Upgrade realizado! 🚀' : 'Plano alterado ✅'}
        </Heading>
        <Text style={text}>
          {name ? `Olá, ${name}!` : 'Olá!'}
        </Text>
        <Text style={text}>
          Sua assinatura foi alterada com sucesso. Confira os detalhes abaixo:
        </Text>

        <Section style={infoBox}>
          <Text style={infoText}><strong>Plano anterior:</strong> {previousPlan}</Text>
          <Text style={infoText}><strong>Novo plano:</strong> {newPlan}</Text>
          <Text style={infoText}><strong>Tipo:</strong> {changeType === 'upgrade' ? 'Upgrade' : 'Downgrade'}</Text>
          {effectiveDate && (
            <Text style={infoText}><strong>Data efetiva:</strong> {effectiveDate}</Text>
          )}
        </Section>

        {(daysRemaining !== undefined || creditAmount || newProRataAmount) && (
          <Section style={summaryBox}>
            <Text style={summaryTitle}>Resumo do saldo</Text>
            {daysUsed !== undefined && daysRemaining !== undefined && (
              <Text style={summaryRow}>
                <strong>Dias do ciclo:</strong> {daysUsed} usados de {totalDays} ({daysRemaining} restantes)
              </Text>
            )}
            {creditAmount && (
              <Text style={summaryRow}>
                <strong>Crédito do plano anterior:</strong> {creditAmount}
              </Text>
            )}
            {newProRataAmount && (
              <Text style={summaryRow}>
                <strong>Custo proporcional no novo plano:</strong> {newProRataAmount}
              </Text>
            )}
            {balanceLabel && (
              <Text
                style={{
                  ...balanceHighlight,
                  color: balanceType === 'credit' ? '#16a34a' : balanceType === 'charge' ? '#1d4ed8' : '#374151',
                }}
              >
                {balanceLabel}
              </Text>
            )}
          </Section>
        )}

        {proRataAmount && (
          <Section style={calculationBox}>
            <Text style={calculationTitle}>Cálculo proporcional</Text>
            <Text style={calculationAmount}>
              {changeType === 'upgrade' ? 'Valor cobrado: ' : 'Crédito aplicado: '}
              <strong>{proRataAmount}</strong>
            </Text>
            {proRataExplanation && (
              <Text style={calculationExplanation}>{proRataExplanation}</Text>
            )}
          </Section>
        )}

        <Text style={text}>
          A partir de agora, você já pode aproveitar todos os recursos do plano {newPlan}.
        </Text>

        <Text style={smallNote}>
          Você pode baixar o comprovante em PDF com o detalhamento completo desta troca acessando
          <strong> Minha Assinatura → Histórico</strong> no seu painel.
        </Text>

        <Hr style={hr} />
        <Text style={text}>
          Se tiver dúvidas ou precisar de ajuda, entre em contato conosco.
        </Text>
        <Text style={footer}>Equipe {SITE_NAME}</Text>
        <SignupFooter unsubscribeUrl={unsubscribeUrl} />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PlanChangedEmail,
  subject: (data: Record<string, any>) =>
    `Seu plano foi alterado para ${data?.newPlan || 'novo plano'} — ${SITE_NAME}`,
  displayName: 'Mudança de plano',
  previewData: {
    name: 'João Silva',
    previousPlan: 'Plano Mensal',
    newPlan: 'Plano Trimestral',
    changeType: 'upgrade',
    proRataAmount: 'R$ 25,00',
    proRataExplanation: 'Diferença proporcional de 15 dias restantes no ciclo atual.',
    effectiveDate: '13/04/2026',
    daysUsed: 15,
    daysRemaining: 15,
    totalDays: 30,
    creditAmount: 'R$ 24,95',
    newProRataAmount: 'R$ 49,95',
    balanceLabel: 'Saldo a pagar agora: R$ 25,00',
    balanceType: 'charge',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#16a34a', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const smallNote = { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 16px', fontStyle: 'italic' as const }
const infoBox = { backgroundColor: '#f0fdf4', borderRadius: '8px', padding: '16px', margin: '0 0 16px' }
const infoText = { fontSize: '14px', color: '#374151', margin: '0 0 4px' }
const summaryBox = { backgroundColor: '#eff6ff', borderRadius: '8px', padding: '16px', margin: '0 0 16px', borderLeft: '4px solid #3b82f6' }
const summaryTitle = { fontSize: '14px', fontWeight: 'bold' as const, color: '#1e3a8a', margin: '0 0 10px' }
const summaryRow = { fontSize: '13px', color: '#374151', margin: '0 0 6px', lineHeight: '1.5' }
const balanceHighlight = { fontSize: '15px', fontWeight: 'bold' as const, margin: '10px 0 0' }
const calculationBox = { backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px', margin: '0 0 16px', borderLeft: '4px solid #6366f1' }
const calculationTitle = { fontSize: '14px', fontWeight: 'bold' as const, color: '#374151', margin: '0 0 8px' }
const calculationAmount = { fontSize: '16px', color: '#111827', margin: '0 0 8px' }
const calculationExplanation = { fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '0' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '30px 0 0' }
