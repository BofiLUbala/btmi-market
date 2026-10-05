import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useColors } from '../store/theme'
import { useI18n } from '../store/i18n'
import { fonts, radius, shadow, spacing, type Colors } from '../theme'
import {
  composeDescription,
  descriptionTemplateFor,
  draftFromDescription,
  type DescriptionDraft,
} from '../lib/productDescription'

/**
 * Structured description input for the seller product screens, mirroring
 * web-app/src/components/seller/DescriptionEditor.tsx. It still reads and
 * writes the single `description` string the API expects.
 */
export function DescriptionEditor({
  categorySlug,
  value,
  onChange,
}: {
  categorySlug?: string | null
  value: string
  onChange: (next: string) => void
}) {
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const { t, lang } = useI18n()
  const template = useMemo(() => descriptionTemplateFor(categorySlug), [categorySlug])
  const [draft, setDraft] = useState<DescriptionDraft>(() => draftFromDescription(value, template))
  const lastEmitted = useRef(value)

  // Re-read when the parent replaces the value (form reset, product loaded).
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value
      setDraft(draftFromDescription(value, template))
    }
  }, [value, template])

  // On a category switch, serialise with the previous template and re-read
  // with the new one, so text without a matching field moves to `extra`.
  const previousTemplate = useRef(template)
  useEffect(() => {
    const from = previousTemplate.current
    previousTemplate.current = template
    if (from.tone === template.tone) return
    setDraft((prev) => draftFromDescription(composeDescription(prev, from, lang), template))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template])

  function update(next: DescriptionDraft) {
    setDraft(next)
    const text = composeDescription(next, template, lang)
    lastEmitted.current = text
    onChange(text)
  }

  return (
    <View style={s.box}>
      <View style={s.head}>
        <Text style={s.title}>{t('seller.descEditor.title')}</Text>
        <View style={s.tone}>
          <Text style={s.toneText}>{t('seller.descEditor.adaptedTo', { tone: t(`seller.descEditor.tone.${template.tone}` as never) })}</Text>
        </View>
      </View>
      <Text style={s.hint}>{t('seller.descEditor.hint')}</Text>

      <Text style={s.label}>{t('seller.descEditor.intro')}</Text>
      <TextInput
        multiline
        value={draft.intro}
        placeholder={template.introPlaceholder[lang]}
        placeholderTextColor={c.mutedLight}
        onChangeText={(intro) => update({ ...draft, intro })}
        style={[s.input, s.inputTall]}
      />

      {template.sections.map((section) => (
        <View key={section.key} style={s.section}>
          <Text style={s.label}>
            {section.label[lang]} <Text style={s.optional}>{t('seller.descEditor.optional')}</Text>
          </Text>
          <TextInput
            multiline
            value={draft.values[section.key] ?? ''}
            placeholder={section.placeholder[lang]}
            placeholderTextColor={c.mutedLight}
            onChangeText={(text) => update({ ...draft, values: { ...draft.values, [section.key]: text } })}
            style={s.input}
          />
        </View>
      ))}

      {draft.extra.length > 0 && (
        <View style={s.extra}>
          <Text style={s.label}>{t('seller.descEditor.otherSections')}</Text>
          {draft.extra.map((section, index) => (
            <View key={`${section.heading}-${index}`} style={s.section}>
              <View style={s.extraHead}>
                <Text style={s.label}>{section.heading}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => update({ ...draft, extra: draft.extra.filter((_, i) => i !== index) })}
                >
                  <Text style={s.remove}>{t('common.remove')}</Text>
                </Pressable>
              </View>
              <TextInput
                multiline
                value={section.body}
                placeholderTextColor={c.mutedLight}
                onChangeText={(body) =>
                  update({ ...draft, extra: draft.extra.map((x, i) => (i === index ? { ...x, body } : x)) })
                }
                style={s.input}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    // White rounded card like the other form sections (reference 10).
    box: { gap: spacing.sm, padding: spacing.md, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.white, ...shadow.card },
    head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
    title: { color: c.ink, fontFamily: fonts.display, fontWeight: '700', fontSize: 16, letterSpacing: -0.2 },
    tone: { borderRadius: 999, backgroundColor: c.greenSoft, paddingHorizontal: 10, paddingVertical: 4 },
    toneText: { color: c.green, fontSize: 11.5, fontWeight: '700' },
    hint: { color: c.muted, fontSize: 12, lineHeight: 17 },
    section: { gap: 6 },
    label: { color: c.ink, fontWeight: '600', fontSize: 13 },
    optional: { color: c.muted, fontWeight: '400', fontSize: 12 },
    // Filled grey textarea, same look as the shared `Field`.
    input: { minHeight: 80, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.borderControl, borderRadius: radius.sm, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, color: c.ink, fontSize: 15, textAlignVertical: 'top' },
    inputTall: { minHeight: 104 },
    extra: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: c.border, borderStyle: 'dashed' },
    extraHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    remove: { color: c.danger, fontWeight: '600', fontSize: 13 },
  })
