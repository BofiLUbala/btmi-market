import { useI18n } from '../store/i18n'
import { useMemo, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useColors } from '../store/theme'
import { fonts, radius, shadow, spacing, type Colors } from '../theme'
import type { StructuredAddressValue } from './StructuredAddressFields'
import { BrandLogo } from './BrandLogo'

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
        <Pressable style={s.shellBack} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(buyer)'))} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={s.shellTitle}>{t('checkout.shellTitle')}</Text>
        <BrandLogo size={30} />
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
      <View style={[s.radio, selected && s.radioOn]}>{selected ? <View style={s.radioDot} /> : null}</View>
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
  const { c, s } = useS()
  const { t } = useI18n()
  const rows: Array<[string, string]> = [
    [t('seller.province'), value.province], [t('common.city'), value.city], [t('common.commune'), value.commune],
    [t('common.address'), value.street], [t('checkoutUI.buildingNumber'), value.building_number],
    ...(value.landmark?.trim() ? [[t('checkoutUI.landmark'), value.landmark] as [string, string]] : []),
  ]
  return (
    <View style={s.summary}>
      <View style={s.pinTile}><Ionicons name="location" size={18} color={c.green} /></View>
      <View style={s.summaryRows}>
        {rows.map(([k, v]) => (
          <View key={k} style={s.summaryRow}>
            <Text style={s.summaryKey}>{k}</Text>
            <Text style={s.summaryVal}>{v}</Text>
          </View>
        ))}
      </View>
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

export const checkoutPage = { padding: spacing.md, gap: 14, paddingBottom: spacing.xl } as const

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    shell: { backgroundColor: c.white, borderBottomWidth: 1, borderBottomColor: c.border },
    shellRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
    shellBack: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' },
    shellTitle: { flex: 1, color: c.ink, fontSize: 18, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.3 },
    heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
    h1: { color: c.ink, fontFamily: fonts.display, fontWeight: '700', fontSize: 22, letterSpacing: -0.3 },
    headingSub: { color: c.muted, marginTop: 4, fontSize: 13.5, lineHeight: 19 },
    pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: c.navy, color: c.onNavy, fontSize: 11.5, fontWeight: '700', overflow: 'hidden' },
    card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md, gap: 12, ...shadow.card },
    rewards: { backgroundColor: c.greenSoft, borderRadius: radius.md, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', borderColor: c.greenSoft },
    rewardsOn: { borderColor: c.green, borderWidth: 1.5 },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    cardTitle: { flex: 1, color: c.ink, fontWeight: '700', fontSize: 15 },
    cardMeta: { color: c.green, fontSize: 12, fontWeight: '700' },
    eyebrow: { color: c.ink, fontSize: 13, fontWeight: '700' },
    h2: { color: c.ink, fontFamily: fonts.display, fontWeight: '700', fontSize: 17, letterSpacing: -0.2 },
    divider: { height: 1, backgroundColor: c.border, marginVertical: 4 },
    switch: { width: 48, height: 28, padding: 3, borderRadius: radius.pill, backgroundColor: c.borderControl },
    switchOn: { backgroundColor: c.green },
    knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', elevation: 2 },
    knobOn: { transform: [{ translateX: 20 }] },
    option: { borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 14, paddingRight: 46, gap: 4, backgroundColor: c.white },
    optionOn: { borderColor: c.green, borderWidth: 1.5 },
    radio: { position: 'absolute', top: 15, right: 15, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: c.borderControl, alignItems: 'center', justifyContent: 'center' },
    radioOn: { borderColor: c.green, backgroundColor: c.green },
    radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.onGreen },
    optionTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    optionTitle: { color: c.ink, fontSize: 14.5, fontWeight: '700', flex: 1 },
    optionAmount: { color: c.green, fontSize: 15, fontWeight: '800' },
    small: { color: c.muted, fontSize: 12.5, lineHeight: 18 },
    summary: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.white },
    pinTile: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
    summaryRows: { flex: 1, gap: 5 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    summaryKey: { color: c.muted, fontSize: 12.5 },
    summaryVal: { color: c.ink, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
    underline: { textAlign: 'center', color: c.green, fontWeight: '700', fontSize: 14, paddingTop: 6, paddingBottom: 2 },
  })
