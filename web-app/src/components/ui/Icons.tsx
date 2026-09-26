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
export function DashboardIcon(props: IconProps) { return <IconBase {...props}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></IconBase> }
export function BusinessIcon(props: IconProps) { return <IconBase {...props}><path d="M4 21V6l8-3 8 3v15M9 9h1M14 9h1M9 13h1M14 13h1M9 17h6"/></IconBase> }
export function CashIcon(props: IconProps) { return <IconBase {...props}><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M7 9H6v1M17 15h1v-1"/></IconBase> }
export function GrowthIcon(props: IconProps) { return <IconBase {...props}><path d="m4 16 5-5 4 4 7-8M15 7h5v5"/></IconBase> }
export function ReviewIcon(props: IconProps) { return <IconBase {...props}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></IconBase> }
export function SettingsIcon(props: IconProps) { return <IconBase {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></IconBase> }
export function LogoutIcon(props: IconProps) { return <IconBase {...props}><path d="M10 17l5-5-5-5M15 12H3M13 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></IconBase> }
export function MenuIcon(props: IconProps) { return <IconBase {...props}><path d="M4 7h16M4 12h16M4 17h16"/></IconBase> }
export function CloseIcon(props: IconProps) { return <IconBase {...props}><path d="m6 6 12 12M18 6 6 18"/></IconBase> }
export function CheckIcon(props: IconProps) { return <IconBase {...props}><path d="M20 6 9 17l-5-5"/></IconBase> }
export function CheckCircleIcon(props: IconProps) { return <IconBase {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></IconBase> }
export function PlusIcon(props: IconProps) { return <IconBase {...props}><path d="M12 5v14M5 12h14"/></IconBase> }
export function ChevronDownIcon(props: IconProps) { return <IconBase {...props}><path d="m6 9 6 6 6-6"/></IconBase> }
export function AlertCircleIcon(props: IconProps) { return <IconBase {...props}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></IconBase> }
export function ShieldCheckIcon(props: IconProps) { return <IconBase {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></IconBase> }
export function RefreshCwIcon(props: IconProps) { return <IconBase {...props}><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></IconBase> }
export function ArrowRightIcon(props: IconProps) { return <IconBase {...props}><path d="M5 12h14M12 5l7 7-7 7"/></IconBase> }
export function CameraIcon(props: IconProps) { return <IconBase {...props}><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/></IconBase> }
export function ImageIcon(props: IconProps) { return <IconBase {...props}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 4-4.5 3.5 3.5 3-3L20 17"/></IconBase> }
export function SunIcon(props: IconProps) { return <IconBase {...props}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></IconBase> }
export function MoonIcon(props: IconProps) { return <IconBase {...props}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></IconBase> }
export function GlobeIcon(props: IconProps) { return <IconBase {...props}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></IconBase> }
export function ChatIcon(props: IconProps) { return <IconBase {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></IconBase> }
export function BellIcon(props: IconProps) { return <IconBase {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></IconBase> }
export function HeartIcon(props: IconProps) { return <IconBase {...props}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.3l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8Z"/></IconBase> }
export function BarChartIcon(props: IconProps) { return <IconBase {...props}><path d="M18 20V10M12 20V4M6 20v-6"/></IconBase> }
export function WrenchIcon(props: IconProps) { return <IconBase {...props}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.7-3.8a6 6 0 0 1-7.4 7.4l-10 10a2.1 2.1 0 1 1-3-3l10-10a6 6 0 0 1 7.4-7.4Z"/></IconBase> }
export function MonitorIcon(props: IconProps) { return <IconBase {...props}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></IconBase> }
export function HomeIcon(props: IconProps) { return <IconBase {...props}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5M10 21v-6h4v6"/></IconBase> }
export function SearchIcon(props: IconProps) { return <IconBase {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></IconBase> }
export function BagIcon(props: IconProps) { return <IconBase {...props}><path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></IconBase> }
export function LoginIcon(props: IconProps) { return <IconBase {...props}><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5M10 17l5-5-5-5M15 12H3"/></IconBase> }
export function TruckIcon(props: IconProps) { return <IconBase {...props}><path d="M2 6h12v10H2zM14 10h4l3 3v3h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></IconBase> }
export function BriefcaseIcon(props: IconProps) { return <IconBase {...props}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/></IconBase> }
export function GridIcon(props: IconProps) { return <IconBase {...props}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></IconBase> }
export function PinIcon(props: IconProps) { return <IconBase {...props}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></IconBase> }
export function CalendarIcon(props: IconProps) { return <IconBase {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></IconBase> }
export function InfoIcon(props: IconProps) { return <IconBase {...props}><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/></IconBase> }
export function WarningIcon(props: IconProps) { return <IconBase {...props}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></IconBase> }
export function BulbIcon(props: IconProps) { return <IconBase {...props}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z"/></IconBase> }
export function FolderIcon(props: IconProps) { return <IconBase {...props}><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"/></IconBase> }
export function ClockIcon(props: IconProps) { return <IconBase {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></IconBase> }
export function CardIcon(props: IconProps) { return <IconBase {...props}><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/></IconBase> }
export function GiftIcon(props: IconProps) { return <IconBase {...props}><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8S10.5 3 8 4.5 9.5 8 12 8ZM12 8s1.5-5 4-3.5S14.5 8 12 8Z"/></IconBase> }
export function FlagIcon(props: IconProps) { return <IconBase {...props}><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></IconBase> }
export function PenIcon(props: IconProps) { return <IconBase {...props}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></IconBase> }
export function XCircleIcon(props: IconProps) { return <IconBase {...props}><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></IconBase> }
export function CompassIcon(props: IconProps) { return <IconBase {...props}><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/></IconBase> }
export function ReceiptIcon(props: IconProps) { return <IconBase {...props}><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/></IconBase> }
export function HandshakeIcon(props: IconProps) { return <IconBase {...props}><path d="m11 17 2 2a1.4 1.4 0 0 0 2-2M14 14l2.5 2.5a1.4 1.4 0 0 0 2-2L15 11M2 11l5-5 4 1 3-1 5 5-3 3M7 6l-5 5 5 5 2-2"/></IconBase> }
export function BuildingIcon(props: IconProps) { return <IconBase {...props}><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1"/></IconBase> }
