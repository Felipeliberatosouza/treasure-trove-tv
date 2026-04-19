import * as React from 'npm:react@18.3.1'
import { Hr, Link, Text } from 'npm:@react-email/components@0.0.22'

interface SignupFooterProps {
  unsubscribeUrl?: string
}

/**
 * Footer shown in all emails sent to students/teachers (welcome, notifications,
 * confirmations, etc.) that explains why they are receiving the email
 * (because they signed up) and offers an unsubscribe link.
 *
 * Unlike MarketingFooter, this footer is always shown — it is informational
 * and required for compliance/transparency, not just for marketing-opted users.
 */
const SignupFooter = ({ unsubscribeUrl }: SignupFooterProps) => (
  <>
    <Hr style={hr} />
    <Text style={footerText}>
      Você está recebendo este e-mail porque se cadastrou na Revisão Fácil.
      {unsubscribeUrl ? (
        <>
          {' '}Se não deseja mais receber nossos e-mails,{' '}
          <Link href={unsubscribeUrl} style={linkStyle}>clique aqui para desabilitar o envio</Link>.
        </>
      ) : null}
    </Text>
  </>
)

export default SignupFooter

const hr = { borderColor: '#e5e7eb', margin: '24px 0 12px' }
const footerText = {
  fontSize: '11px',
  color: '#9ca3af',
  lineHeight: '1.5',
  margin: '0',
  textAlign: 'center' as const,
}
const linkStyle = {
  color: '#6366f1',
  textDecoration: 'underline' as const,
}
