import { useMemo, useState, type ReactNode } from 'react'
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useColors } from '../store/theme'
import { parseDescription } from '../lib/productDescription'
import type { Colors } from '../theme'

export interface AccordionItem {
  id: string
  title: string
  content: ReactNode
  defaultOpen?: boolean
}

/** Collapsible sections, the RN counterpart of the web's <details> accordion. */
export function Accordion({ items }: { items: AccordionItem[] }) {
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.filter((i) => i.defaultOpen).map((i) => [i.id, true]))
  )
  return (
    <View style={s.list}>
      {items.map((item) => {
        const expanded = Boolean(open[item.id])
        return (
          <View key={item.id} style={s.item}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                setOpen((prev) => ({ ...prev, [item.id]: !expanded }))
              }}
              style={s.summary}
            >
              <Text style={s.title}>{item.title}</Text>
              <Ionicons name={expanded ? 'remove' : 'add'} size={20} color={c.ink} />
            </Pressable>
            {expanded && <View style={s.body}>{item.content}</View>}
          </View>
        )
      })}
    </View>
  )
}

/** Paragraph renderer shared by description sections. */
export function DescriptionText({ text }: { text: string }) {
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
  return (
    <View style={{ gap: 6 }}>
      {lines.map((line, i) => (
        <Text key={i} style={s.paragraph}>{line}</Text>
      ))}
    </View>
  )
}

/** The stored description's `## ` sections as accordion items. */
export function descriptionItems(text?: string | null): { intro: string; items: AccordionItem[] } {
  const parsed = parseDescription(text)
  return {
    intro: parsed.intro,
    items: parsed.sections.map((section, i) => ({
      id: `desc-${i}`,
      title: section.heading,
      content: <DescriptionText text={section.body} />,
    })),
  }
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    list: { borderTopWidth: 1, borderTopColor: c.border },
    item: { borderBottomWidth: 1, borderBottomColor: c.border },
    summary: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 14 },
    title: { flex: 1, color: c.ink, fontWeight: '600', fontSize: 15 },
    body: { paddingBottom: 18 },
    paragraph: { color: c.muted, lineHeight: 22, fontSize: 14 },
    previewHeading: { color: c.ink, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' },
  })

/** Compact read-only rendering of a structured description (seller side). */
export function DescriptionPreview({ text }: { text: string }) {
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const parsed = parseDescription(text)
  return (
    <View style={{ gap: 8 }}>
      {parsed.intro ? <DescriptionText text={parsed.intro} /> : null}
      {parsed.sections.map((section) => (
        <View key={section.heading} style={{ gap: 2 }}>
          <Text style={s.previewHeading}>{section.heading}</Text>
          <DescriptionText text={section.body} />
        </View>
      ))}
    </View>
  )
}
