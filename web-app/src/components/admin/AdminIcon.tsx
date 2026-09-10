import type { IconName } from './adminNav'

/* Stroked 24x24 paths on a shared grid. Emoji were inconsistent in weight and
 * colour and read as decoration once the rail collapses to icons only. */
const PATHS: Record<IconName, string> = {
  compass: 'M12 21a9 9 0 100-18 9 9 0 000 18zM15.5 8.5l-2 5-5 2 2-5 5-2z',
  box: 'M21 8l-9-5-9 5m18 0v8l-9 5-9-5V8m18 0l-9 5-9-5',
  wallet: 'M3 7a2 2 0 012-2h12a2 2 0 012 2M3 7v10a2 2 0 002 2h14a2 2 0 002-2v-6a2 2 0 00-2-2H5a2 2 0 01-2-2zm13 5h.01',
  shield: 'M12 3l8 3v6c0 4.5-3.2 7.9-8 9-4.8-1.1-8-4.5-8-9V6l8-3z',
  users: 'M16 19v-1.5A3.5 3.5 0 0012.5 14h-5A3.5 3.5 0 004 17.5V19M10 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm10 8v-1.5a3.5 3.5 0 00-2.6-3.4M15 4.1a3.5 3.5 0 010 6.8',
  flag: 'M5 21V4m0 0h9l-1.5 3L14 10H5',
  sliders: 'M4 7h10m4 0h2M4 17h4m4 0h8M16 7a2 2 0 104 0 2 2 0 00-4 0zM8 17a2 2 0 104 0 2 2 0 00-4 0z',
  gauge: 'M12 20a8 8 0 100-16 8 8 0 000 16zm0-8l4-3',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  scroll: 'M6 4h10a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2zm3 4h6M9 12h6M9 16h3',
  tag: 'M3 12V4h8l9 9-8 8-9-9zm4-4h.01',
  layers: 'M12 3l9 5-9 5-9-5 9-5zm9 11l-9 5-9-5',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zm0-14v5l3 2',
  cart: 'M3 4h2l2.5 11h11L21 7H6M9 20a1 1 0 100-2 1 1 0 000 2zm9 0a1 1 0 100-2 1 1 0 000 2z',
  badge: 'M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 8.7l5.4-.8L12 3z',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zm10 2l-4.4-4.4',
  trending: 'M3 17l6-6 4 4 8-8m0 0h-5m5 0v5',
  sparkle: 'M12 4l1.8 4.7L18.5 10l-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.3L12 4zM18 17l.9 2.1L21 20l-2.1.9L18 23l-.9-2.1L15 20l2.1-.9L18 17z',
  percent: 'M6 18L18 6M7.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm9 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  store: 'M4 9h16v10a1 1 0 01-1 1H5a1 1 0 01-1-1V9zm0 0l1.5-5h13L20 9M9 20v-6h6v6',
  chart: 'M4 20V10m5 10V4m5 16v-7m5 7V8',
  coins: 'M9 12a5 3 0 100-6 5 3 0 000 6zm-5 3a5 3 0 1010 0M4 9v6m10-6v6a5 3 0 01-10 0M14 9a5 3 0 100-6 5 3 0 000 6zm5-3v6a5 3 0 01-5 3',
  gift: 'M4 11h16v9a1 1 0 01-1 1H5a1 1 0 01-1-1v-9zm-1-4h18v4H3V7zm9 0v14M12 7S9.5 3 7.5 4.2 9 7 12 7zm0 0s2.5-4 4.5-2.8S15 7 12 7z',
  growth: 'M4 19h16M7 19V9m5 10V5m5 14v-6',
  star: 'M12 4l2.5 5.1 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 4z',
  storefront: 'M4 9h16v10a1 1 0 01-1 1H5a1 1 0 01-1-1V9zm0 0l1.5-5h13L20 9M8 20v-5h4v5',
  case: 'M4 8h16a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1zm5 0V6a2 2 0 012-2h2a2 2 0 012 2v2',
  alert: 'M12 4l9 16H3l9-16zm0 6v4m0 3h.01',
  heart: 'M12 20s-7-4.4-7-9a4 4 0 017-2.6A4 4 0 0119 11c0 4.6-7 9-7 9z',
  database: 'M12 8c4.4 0 8-1.1 8-2.5S16.4 3 12 3 4 4.1 4 5.5 7.6 8 12 8zM4 5.5v13C4 19.9 7.6 21 12 21s8-1.1 8-2.5v-13M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6l1-7z',
  cog: 'M12 15a3 3 0 100-6 3 3 0 000 6zm8-3a8 8 0 00-.2-1.7l2-1.5-2-3.5-2.3 1a8 8 0 00-3-1.7L14 2h-4l-.5 2.6a8 8 0 00-3 1.7l-2.3-1-2 3.5 2 1.5a8 8 0 000 3.4l-2 1.5 2 3.5 2.3-1a8 8 0 003 1.7L10 22h4l.5-2.6a8 8 0 003-1.7l2.3 1 2-3.5-2-1.5c.1-.6.2-1.1.2-1.7z',
  mail: 'M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1zm0 1l8 6 8-6',
  lock: 'M6 11h12a1 1 0 011 1v7a1 1 0 01-1 1H6a1 1 0 01-1-1v-7a1 1 0 011-1zm2 0V8a4 4 0 018 0v3',
  key: 'M15 4a5 5 0 11-4.6 7L4 17.4V20h3v-2h2v-2h2l1.4-1.4A5 5 0 0115 4zm1.5 4h.01',
  branch: 'M7 4v11m0 0a3 3 0 103 3m-3-3a3 3 0 013 3m7-14a3 3 0 100 6 3 3 0 000-6zm0 6v2a4 4 0 01-4 4h-3',
  phone: 'M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1zm3 15h2'
}

export function AdminIcon({ name, size = 17 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0 }}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
