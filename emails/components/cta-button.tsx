import { Link } from '@react-email/components'

interface CtaButtonProps {
  href: string
  label: string
}

export function CtaButton({ href, label }: CtaButtonProps) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-block',
        background: 'linear-gradient(135deg, #C2EC77 0%, #B3E153 55%, #A4D62F 100%)',
        color: '#141414',
        fontFamily: "'Chakra Petch', Arial, sans-serif",
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        padding: '13px 30px',
        borderRadius: '12px',
        boxShadow: '3px 3px 0 rgba(90,140,0,0.6)',
        textDecoration: 'none',
      }}
    >
      {label}
    </Link>
  )
}
