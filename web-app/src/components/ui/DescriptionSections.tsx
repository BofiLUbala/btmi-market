import type { ReactNode } from 'react'
import { parseDescription } from '@/lib/productDescription'

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n{2,}|\n/)
        .map((line) => line.replace(/^[-•]\s*/, '').trim())
        .filter(Boolean)
        .map((line, i) => (
          <p key={i}>{line}</p>
        ))}
    </>
  )
}

/** Compact read-only rendering used on the seller side. */
export function DescriptionPreview({ text }: { text: string }) {
  const parsed = parseDescription(text)
  return (
    <div className="desc-preview">
      {parsed.intro && <Paragraphs text={parsed.intro} />}
      {parsed.sections.map((section) => (
        <div key={section.heading} className="desc-preview-section">
          <span className="desc-preview-heading">{section.heading}</span>
          <Paragraphs text={section.body} />
        </div>
      ))}
    </div>
  )
}

export interface AccordionItem {
  id: string
  title: string
  content: ReactNode
  defaultOpen?: boolean
}

/** Native <details> accordion: keyboard and screen-reader support for free. */
export function Accordion({ items }: { items: AccordionItem[] }) {
  return (
    <div className="accordion">
      {items.map((item) => (
        <details key={item.id} className="accordion-item" open={item.defaultOpen}>
          <summary className="accordion-summary">
            <span>{item.title}</span>
            <span className="accordion-icon" aria-hidden="true" />
          </summary>
          <div className="accordion-body">{item.content}</div>
        </details>
      ))}
    </div>
  )
}

/** Turns the stored description's `## ` sections into accordion items. */
export function descriptionAccordionItems(text?: string | null): { intro: string; items: AccordionItem[] } {
  const parsed = parseDescription(text)
  return {
    intro: parsed.intro,
    items: parsed.sections.map((section, i) => ({
      id: `desc-${i}`,
      title: section.heading,
      content: <Paragraphs text={section.body} />,
    })),
  }
}

export { Paragraphs as DescriptionParagraphs }
