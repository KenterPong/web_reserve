import Link from 'next/link'
import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand'

type BrandLogoProps = {
  href?: string
  showTagline?: boolean
  size?: number
  className?: string
}

export function BrandLogo({
  href = '/',
  showTagline = true,
  size = 36,
  className = '',
}: BrandLogoProps) {
  const inner = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.svg"
        alt={BRAND_NAME}
        width={size}
        height={size}
        className="shrink-0 rounded-lg"
      />
      <div className="leading-tight text-left">
        <span className="font-bold text-gray-800 block text-sm">{BRAND_NAME}</span>
        {showTagline ? (
          <span className="text-xs text-gray-500 font-normal">{BRAND_TAGLINE}</span>
        ) : null}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="hover:opacity-90 transition-opacity">
        {inner}
      </Link>
    )
  }

  return inner
}
