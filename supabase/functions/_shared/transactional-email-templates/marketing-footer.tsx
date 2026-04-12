import * as React from 'npm:react@18.3.1'
import { Hr, Link, Text } from 'npm:@react-email/components@0.0.22'

interface MarketingFooterProps {
  unsubscribeUrl?: string
}

/**
 * Footer shown only for users who accepted marketing emails.
 * Renders nothing if unsubscribeUrl is not provided.
 */
const MarketingFooter = ({ unsubscribeUrl }: MarketingFooterProps) => {
  if (!unsubscribeUrl) return null

  return (
    <>
      <Hr style={hr} />
      <Text style={marketingText}>
        Você está recebendo este e-mail porque concordou em receber e-mails promocionais da Revisão Fácil quando fez o seu cadastro.
        {' '}Se quiser parar de receber nossos e-mails,{' '}
        <Link href={unsubscribeUrl} style={linkStyle}>clique aqui</Link>.
      </Text>
    </>
  )
}

export default MarketingFooter

const hr = { borderColor: '#e5e7eb', margin: '24px 0 12px' }
const marketingText = {
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
