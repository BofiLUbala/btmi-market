import type { ReactNode, SVGProps } from 'react'
import { descriptionTone, type DescriptionTone } from '@/lib/productDescription'

/**
 * Line icon for a category, drawn in the same 24px stroke style as
 * components/ui/Icons.tsx. The slug -> tone mapping is the one the product
 * description templates use, so a category's icon and its seller form always
 * agree on what kind of category it is.
 */
const PATHS: Record<DescriptionTone, ReactNode> = {
  fashion: <path d="M8 3 4 5.5 2.5 10l3 1.2V21h13v-9.8l3-1.2L20 5.5 16 3a4 4 0 0 1-8 0Z" />,
  shoes: <><path d="M3 17v-6.5l3.5-.5L9 7l2.5 3.5 3.5 1.8 5 1.2a2 2 0 0 1 1.5 2V17Z" /><path d="M3 20h18.5M7.5 10.5l1 1.5M10 9.8l1 1.4" /></>,
  children: <><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></>,
  electronics: <><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></>,
  home: <><path d="M4 20v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7" /><path d="M6 11V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3M4 16h16M5 20v1M19 20v1" /></>,
  beauty: <><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8Z" /><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z" /></>,
  food: <><path d="M4 11h16a8 8 0 0 1-16 0Z" /><path d="M9 7c0-1.5 1-2 1-3.5M13 7c0-1.5 1-2 1-3.5M8 21h8" /></>,
  sport: <><circle cx="12" cy="12" r="9" /><path d="M3.5 9.5c4 1.5 13 1.5 17 0M3.5 14.5c4-1.5 13-1.5 17 0M12 3c-2.5 3-2.5 15 0 18M12 3c2.5 3 2.5 15 0 18" /></>,
  automotive: <><path d="M3 16v-4l2-5a2 2 0 0 1 1.9-1.4h10.2A2 2 0 0 1 19 7l2 5v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /><path d="M3.5 12h17" /><circle cx="7.5" cy="17" r="2" /><circle cx="16.5" cy="17" r="2" /></>,
  services: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.7-3.8a6 6 0 0 1-7.4 7.4l-7.6 7.6a2.1 2.1 0 1 1-3-3l7.6-7.6a6 6 0 0 1 7.4-7.4Z" />,
  books: <><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5Z" /><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M8 7h8" /></>,
  jewelry: <><path d="M6 3h12l3 5-9 13L3 8Z" /><path d="M3 8h18M9 3l3 5 3-5M12 8v13" /></>,
  health: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" /></>,
  pets: <><circle cx="6" cy="10" r="1.8" /><circle cx="10" cy="6" r="1.8" /><circle cx="14" cy="6" r="1.8" /><circle cx="18" cy="10" r="1.8" /><path d="M12 11c-3 0-5.5 4-5.5 6.3 0 1.6 1.3 2.7 2.8 2.7 1 0 1.8-.5 2.7-.5s1.7.5 2.7.5c1.5 0 2.8-1.1 2.8-2.7C17.5 15 15 11 12 11Z" /></>,
  stationery: <><path d="M15 3h4v4L8 18l-4 1 1-4Z" /><path d="M13 5l4 4M3 21h18" /></>,
  garden: <><path d="M12 21v-9" /><path d="M12 12C12 7 8 4 3 4c0 5 4 8 9 8ZM12 14c0-4 3-7 8-7 0 4-3 7-8 7Z" /></>,
  music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  hardware: <><path d="m15 12-8.4 8.4a2.1 2.1 0 1 1-3-3L12 9" /><path d="M17.6 15 22 10.6M20.9 11.7l-1.2-1.2c-.6-.6-1-1.4-1-2.3v-.9L16 4.6A5.6 5.6 0 0 0 12.1 3H9l.9.8A6.2 6.2 0 0 1 12 8.4V10l2 2h2.5l2.3 1.9" /></>,
  default: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
}

type Props = SVGProps<SVGSVGElement> & { slug?: string | null }

export function CategoryIcon({ slug, ...props }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {PATHS[descriptionTone(slug)]}
    </svg>
  )
}
