import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import {
  countryByIso,
  countryName,
  fromE164,
  searchCountries,
  toE164,
  type Country,
} from '../lib/countryCodes'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, spacing, type Colors } from '../theme'

/**
 * A phone field with the country's calling code beside it.
 *
 * `value` and `onChange` speak E.164 ("+243970000000") throughout, so callers
 * never assemble a number themselves; the split into country and national
 * digits exists only inside this component. A number typed with its trunk "0"
 * is accepted and the zero dropped, because that is how people write their own
 * number locally.
 */
export function PhoneInput({
  label,
  value,
  onChange,
  onSubmitEditing,
  autoFocus,
  error,
  testID,
}: {
  label: string
  value: string
  onChange: (e164: string) => void
  onSubmitEditing?: () => void
  autoFocus?: boolean
  error?: string
  testID?: string
}) {
  const { t, lang } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()

  const initial = useRef(value ? fromE164(value) : null).current
  const [country, setCountry] = useState<Country>(initial?.country ?? countryByIso(null))
  const [national, setNational] = useState(initial?.nationalNumber ?? '')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const numberRef = useRef<TextInput>(null)

  // The parent owns the value; re-publish it whenever either half changes.
  const publish = useRef(onChange)
  publish.current = onChange
  // What this field last sent up, so the echo of its own value can be told
  // apart from a number that genuinely arrived from elsewhere.
  const published = useRef<string | null>(null)

  /**
   * Adopt a value the parent set itself — a profile loaded from the server
   * after the first render, or a form reset. The echo of what this field just
   * published is skipped, so re-seeding never fights the typing.
   */
  useEffect(() => {
    if (value === published.current) return
    const next = value ? fromE164(value) : null
    setCountry(next?.country ?? countryByIso(null))
    setNational(next?.nationalNumber ?? '')
  }, [value])

  useEffect(() => {
    const next = toE164(country, national)
    published.current = next
    publish.current(next)
  }, [country, national])

  const results = useMemo(() => searchCountries(query, lang), [query, lang])

  // The list hangs off the country button instead of taking the whole screen:
  // the field stays visible, so it is clear what is being changed.
  const anchorRef = useRef<View>(null)
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  function openPicker() {
    const node = anchorRef.current
    if (!node) { setPickerOpen(true); return }
    node.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height })
      setPickerOpen(true)
    })
  }

  const panelWidth = Math.min(320, screenWidth - 2 * spacing.md)
  const gap = 6
  const roomBelow = anchor ? screenHeight - (anchor.y + anchor.height) - gap - 8 : 0
  const roomAbove = anchor ? anchor.y - gap - 8 : 0
  // Flip above the field when the keyboard or the page bottom leaves no room.
  const openUp = anchor ? roomBelow < 220 && roomAbove > roomBelow : false
  const panelHeight = Math.max(180, Math.min(320, openUp ? roomAbove : roomBelow))
  const panelLeft = anchor
    ? Math.min(Math.max(spacing.md, anchor.x), Math.max(spacing.md, screenWidth - panelWidth - spacing.md))
    : spacing.md
  const panelTop = anchor
    ? (openUp ? anchor.y - gap - panelHeight : anchor.y + anchor.height + gap)
    : 100

  function choose(next: Country) {
    setCountry(next)
    setPickerOpen(false)
    setQuery('')
    numberRef.current?.focus()
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <View ref={anchorRef} collapsable={false}>
          <Pressable
            onPress={openPicker}
            style={styles.country}
            accessibilityRole="button"
            accessibilityLabel={t('auth.phone.countryLabel')}
            accessibilityHint={countryName(country, lang)}
            testID={testID ? `${testID}-country` : 'phone-country'}
          >
            {/* The ISO code, not a flag: Android's system fonts have no flag
                emoji, which would leave an empty box on most devices. */}
            <Text style={styles.iso}>{country.iso}</Text>
            <Text style={styles.dial}>+{country.dial}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.muted} />
          </Pressable>
        </View>
        <TextInput
          ref={numberRef}
          style={styles.number}
          value={national}
          onChangeText={(text) => setNational(text.replace(/[^\d\s-]/g, ''))}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          autoFocus={autoFocus}
          returnKeyType="go"
          onSubmitEditing={onSubmitEditing}
          placeholder={t('auth.phone.numberPlaceholder')}
          placeholderTextColor={colors.faint}
          testID={testID ?? 'phone-number'}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        {/* Tapping anywhere off the panel closes it, the way a dropdown does. */}
        <Pressable
          style={styles.backdrop}
          onPress={() => setPickerOpen(false)}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View
          style={[styles.panel, { width: panelWidth, height: panelHeight, left: panelLeft, top: panelTop }]}
          testID="phone-country-panel"
        >
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            placeholder={t('auth.phone.searchCountry')}
            placeholderTextColor={colors.faint}
            testID="phone-country-search"
          />
          <FlatList
            data={results}
            keyExtractor={(item) => item.iso}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={14}
            renderItem={({ item }) => {
              const selected = item.iso === country.iso
              return (
                <Pressable
                  onPress={() => choose(item)}
                  style={[styles.option, selected && styles.optionSelected]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                >
                  <Text style={styles.optionIso}>{item.iso}</Text>
                  <Text style={styles.optionName} numberOfLines={1}>{countryName(item, lang)}</Text>
                  <Text style={styles.optionDial}>+{item.dial}</Text>
                </Pressable>
              )
            }}
            ListEmptyComponent={<Text style={styles.empty}>{t('auth.phone.noCountry')}</Text>}
          />
        </View>
      </Modal>
    </View>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  field: { gap: 8 },
  label: { color: colors.ink, fontWeight: '600', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  country: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 52,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2,
  },
  iso: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  dial: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  number: {
    // minWidth 0 lets the field shrink beside the country button; on the web a
    // text input otherwise keeps its ~250px intrinsic width and spills off a
    // phone-width screen.
    flex: 1, minWidth: 0, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface2, paddingHorizontal: 16, color: colors.ink, fontSize: 16,
  },
  error: { color: colors.danger, fontSize: 13 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // A small card hanging off the country button, not a full-screen sheet.
  panel: {
    position: 'absolute', backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden', paddingTop: 8,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  search: {
    marginHorizontal: 8, marginBottom: 6, minHeight: 38, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2,
    paddingHorizontal: 10, color: colors.ink, fontSize: 14,
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 9 },
  optionSelected: { backgroundColor: colors.surface2 },
  optionIso: { color: colors.muted, fontSize: 11, fontWeight: '700', width: 24 },
  optionName: { flex: 1, color: colors.ink, fontSize: 14 },
  optionDial: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  empty: { color: colors.muted, textAlign: 'center', padding: spacing.md, fontSize: 13 },
})
