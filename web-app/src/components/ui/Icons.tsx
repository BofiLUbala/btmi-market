import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function IconBase({ children, ...props }: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>
}

export function EyeIcon(props: IconProps) {
  return <IconBase {...props}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></IconBase>
}

export function EyeOffIcon(props: IconProps) {
  return <IconBase {...props}><path d="m3 3 18 18"/><path d="M10.6 6.1A10.8 10.8 0 0 1 12 6c6 0 9.5 6 9.5 6a16.7 16.7 0 0 1-2.2 2.9M6.6 6.6C4 8.3 2.5 12 2.5 12s3.5 6 9.5 6a9.4 9.4 0 0 0 3-.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></IconBase>
}

export function StoreIcon(props: IconProps) { return <IconBase {...props}><path d="M3 9h18l-1.5-5h-15L3 9Z"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></IconBase> }
export function BoxIcon(props: IconProps) { return <IconBase {...props}><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="m4 7 8 4v10l8-4V7M12 11v10"/></IconBase> }
export function StockIcon(props: IconProps) { return <IconBase {...props}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></IconBase> }
export function OrdersIcon(props: IconProps) { return <IconBase {...props}><path d="M7 3h10v4H7zM5 5H3v16h18V5h-2M8 12h8M8 16h5"/></IconBase> }
export function UsersIcon(props: IconProps) { return <IconBase {...props}><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1"/></IconBase> }
export function CustomerIcon(props: IconProps) { return <IconBase {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></IconBase> }
