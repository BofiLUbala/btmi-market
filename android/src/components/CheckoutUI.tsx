import { useI18n } from '../store/i18n'
import { useMemo, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useColors } from '../store/theme'
import { fonts, spacing, type Colors } from '../theme'
import type { StructuredAddressValue } from './StructuredAddressFields'

/**
 * Native versions of the web checkout building blocks (pages.css:
 * .checkout-shell-header, .checkout-heading, .checkout-card, .eyebrow,
 * .toggle-switch, .address-summary) so delivery/payment/success read the
 * same on both apps.
 */
function useS() {
  const c = useColors()
  return { c, s: useMemo(() => makeStyles(c), [c]) }
}

/** web .checkout-shell-header: ← | Checkout | TBK */
export function CheckoutHeader() {
  const { c, s } = useS()
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  return (
    <View style={[s.shell, { paddingTop: insets.top }]}>
      <View style={s.shellRow}>
        <Pressable style={s.shellBack} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(buyer)'))} accessibilityRole="button" accessibilityLabel="Retour">
          <Text style={s.shellBackText}>←</Text>
        </Pressable>
        <Text style={s.shellTitle}>{t('checkout.shellTitle')}</Text>
        <Text style={[s.shellBrand, { color: c.ink }]}>TBK</Text>
      </View>
    </View>
  )
}

export function CheckoutHeading({ title, subtitle, pill }: { title: string; subtitle?: ReactNode; pill?: string }) {
  const { s } = useS()
  return (
    <View style={s.heading}>
      <View style={{ flex: 1 }}>
        <Text style={s.h1}>{title}</Text>
        {subtitle ? <Text style={s.headingSub}>{subtitle}</Text> : null}
      </View>
      {pill ? <Text style={s.pill}>{pill}</Text> : null}
    </View>
  )
}

export function CheckoutCard({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'rewards' | 'rewardsOn' }) {
  const { s } = useS()
  return <View style={[s.card, tone === 'rewards' && s.rewards, tone === 'rewardsOn' && [s.rewards, s.rewardsOn], style]}>{children}</View>
}

export function CardHead({ title, meta }: { title: string; meta?: string }) {
  const { s } = useS()
  return (
    <View style={s.cardHead}>
      <Text style={s.cardTitle} numberOfLines={1}>{title}</Text>
      {meta ? <Text style={s.cardMeta}>{meta}</Text> : null}
    </View>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  const { s } = useS()
  return <Text style={s.eyebrow}>{children}</Text>
}

export function H2({ children }: { children: ReactNode }) {
  const { s } = useS()
  return <Text style={s.h2}>{children}</Text>
}

export function Divider() {
  const { s } = useS()
  return <View style={s.divider} />
}

/** web .toggle-switch */
export function ToggleSwitch({ on, onPress, disabled, label }: { on: boolean; onPress: () => void; disabled?: boolean; label?: string }) {
  const { s } = useS()
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[s.switch, on && s.switchOn, disabled && { opacity: 0.5 }]}
    >
      <View style={[s.knob, on && s.knobOn]} />
    </Pressable>
  )
}

/** web .delivery-option (selected, with the radio in the corner) */
export function OptionCard({ title, amount, lines, selected = true }: { title: string; amount?: string; lines: string[]; selected?: boolean }) {
  const { s } = useS()
  return (
    <View style={[s.option, selected && s.optionOn]}>
      <View style={[s.radio, selected && s.radioOn]} />
      <View style={s.optionTop}>
        <Text style={s.optionTitle}>{title}</Text>
        {amount ? <Text style={s.optionAmount}>{amount}</Text> : null}
      </View>
      {lines.map((line) => <Text key={line} style={s.small}>{line}</Text>)}
    </View>
  )
}

/** web StructuredAddressSummary (.address-summary) */
export function AddressSummary({ value }: { value: StructuredAddressValue }) {
  const { s } = useS()
  const rows: Array<[string, string]> = [
    ['Province', value.province], ['Ville', value.city], ['Commune', value.commune],
    ['Adresse', value.street], ['Numéro', value.building_number],
    ...(value.landmark?.trim() ? [['Point de repère', value.landmark] as [string, string]] : []),
  ]
  return (
    <View style={s.summary}>
      {rows.map(([k, v]) => (
        <View key={k} style={s.summaryRow}>
          <Text style={s.summaryKey}>{k}</Text>
          <Text style={s.summaryVal}>{v}</Text>
        </View>
      ))}
    </View>
  )
}

export function SmallText({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { s } = useS()
  return <Text style={[s.small, style as never]}>{children}</Text>
}

/** web .delivery-custom-link */
export function UnderlineLink({ title, onPress }: { title: string; onPress: () => void }) {
  const { s } = useS()
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Text style={s.underline}>{title}</Text>
    </Pressable>
  )
}

export const checkoutPage = { padding: spacing.md, gap: 22, paddingBottom: spacing.xl } as const

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    shell: { backgroundColor: c.white, borderBottomWidth: 1, borderBottomColor: c.border },
    shellRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
    shellBack: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center' },
    shellBackText: { color: c.ink, fontSize: 21 },
    shellTitle: { flex: 1, textAlign: 'center', color: c.ink, fontSize: 17, fontWeight: '700' },
    shellBrand: { width: 40, textAlign: 'right', fontSize: 11.5, fontWeight: '700' },
    heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
    h1: { color: c.ink, fontFamily: fonts.display, fontWeight: '500', fontSize: 29, letterSpacing: -0.4 },
    headingSub: { color: c.muted, marginTop: 5, fontSize: 15 },
    pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: c.surface2, color: c.muted, fontSize: 14, overflow: 'hidden' },
    card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 17, gap: 12 },
    rewards: { backgroundColor: c.goldSoft, borderRadius: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
    rewardsOn: { borderColor: c.gold },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border },
    cardTitle: { flex: 1, color: c.ink, fontFamily: fonts.display, fontWeight: '500', fontSize: 18 },
    cardMeta: { color: c.muted, fontSize: 14 },
    eyebrow: { color: c.ink, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase' },
    h2: { color: c.ink, fontFamily: fonts.display, fontWeight: '500', fontSize: 22 },
    divider: { height: 1, backgroundColor: c.border, marginVertical: 4 },
    switch: { width: 50, height: 28, padding: 3, borderRadius: 999, backgroundColor: c.border },
    switchOn: { backgroundColor: c.green },
    knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', elevation: 2 },
    knobOn: { transform: [{ translateX: 22 }] },
    option: { borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 16, paddingRight: 46, gap: 5, backgroundColor: c.white },
    optionOn: { borderColor: c.green, borderWidth: 1.5 },
    radio: { position: 'absolute', top: 18, right: 18, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: c.border },
    radioOn: { borderWidth: 6, borderColor: c.green },
    optionTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    optionTitle: { color: c.ink, fontSize: 16, fontWeight: '700', flex: 1 },
    optionAmount: { color: c.ink, fontSize: 16, fontWeight: '700' },
    small: { color: c.muted, fontSize: 14, lineHeight: 20 },
    summary: { gap: 6, padding: 12, borderRadius: 12, backgroundColor: c.surface2 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    summaryKey: { color: c.muted, fontSize: 14 },
    summaryVal: { color: c.ink, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
    underline: { textAlign: 'center', color: c.ink, fontWeight: '700', fontSize: 15, textDecorationLine: 'underline', paddingTop: 8, paddingBottom: 2 },
  })
