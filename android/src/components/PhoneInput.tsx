import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
  const insets = useSafeAreaInsets()

  // Only the first value seeds the fields; after that this component owns the
  // split, and echoing the parent back would fight the typing.
  const initial = useRef(value ? fromE164(value) : null).current
  const [country, setCountry] = useState<Country>(initial?.country ?? countryByIso(null))
  const [national, setNational] = useState(initial?.nationalNumber ?? '')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const numberRef = useRef<TextInput>(null)

  // The parent owns the value; re-publish it whenever either half changes.
  const publish = useRef(onChange)
  publish.current = onChange
  useEffect(() => { publish.current(toE164(country, national)) }, [country, national])

  const results = useMemo(() => searchCountries(query, lang), [query, lang])

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
        <Pressable
          onPress={() => setPickerOpen(true)}
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

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={[styles.sheet, { paddingTop: insets.top }]}>
          <View style={styles.sheetHead}>
            <Pressable
              onPress={() => setPickerOpen(false)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={24} color={colors.ink} />
            </Pressable>
            <Text style={styles.sheetTitle}>{t('auth.phone.chooseCountry')}</Text>
          </View>
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
            initialNumToRender={20}
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
    flex: 1, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface2, paddingHorizontal: 16, color: colors.ink, fontSize: 16,
  },
  error: { color: colors.danger, fontSize: 13 },
  sheet: { flex: 1, backgroundColor: colors.white },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sheetTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  search: {
    marginHorizontal: spacing.md, marginBottom: spacing.sm, minHeight: 46, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2,
    paddingHorizontal: 14, color: colors.ink, fontSize: 15,
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.md, paddingVertical: 14 },
  optionSelected: { backgroundColor: colors.surface2 },
  optionIso: { color: colors.muted, fontSize: 12, fontWeight: '700', width: 28 },
  optionName: { flex: 1, color: colors.ink, fontSize: 15 },
  optionDial: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  empty: { color: colors.muted, textAlign: 'center', padding: spacing.lg },
})
