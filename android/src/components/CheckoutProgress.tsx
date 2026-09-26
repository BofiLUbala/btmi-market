import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useColors } from '../store/theme'
import { useI18n } from '../store/i18n'
import type { Colors } from '../theme'
import type { TranslationKey } from '../locales/fr'

const STEPS: Array<{ id: 'cart' | 'delivery' | 'payment' | 'order'; label: TranslationKey }> = [
  { id: 'cart', label: 'checkout.step.cart' },
  { id: 'delivery', label: 'checkout.step.delivery' },
  { id: 'payment', label: 'checkout.step.review' },
  { id: 'order', label: 'checkout.step.order' },
]

/** Numbered circles joined by a line: the web's CheckoutProgress, natively. */
export function CheckoutProgress({ current }: { current: (typeof STEPS)[number]['id'] }) {
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const { t } = useI18n()
  const active = STEPS.findIndex((step) => step.id === current)
  return (
    <View style={s.row} accessibilityRole="progressbar" accessibilityLabel={t('checkout.progress')}>
      {STEPS.map((step, index) => {
        const done = index < active
        const on = index <= active
        return (
          <View key={step.id} style={s.step}>
            {index < STEPS.length - 1 ? <View style={[s.line, index < active && s.lineOn]} /> : null}
            <View style={[s.circle, on && s.circleOn]}>
              {done ? <Ionicons name="checkmark" size={16} color={c.onGreen} /> : <Text style={[s.num, on && s.numOn]}>{index + 1}</Text>}
            </View>
            <Text style={[s.label, on && s.labelOn]} numberOfLines={1}>{t(step.label)}</Text>
          </View>
        )
      })}
    </View>
  )
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', marginBottom: 4 },
    step: { flex: 1, alignItems: 'center', gap: 6 },
    line: { position: 'absolute', top: 15, left: '50%', right: '-50%', marginLeft: 20, marginRight: 20, height: 2, backgroundColor: c.border },
    lineOn: { backgroundColor: c.green },
    circle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: c.border, backgroundColor: c.cream, alignItems: 'center', justifyContent: 'center' },
    circleOn: { borderColor: c.green, backgroundColor: c.green },
    num: { color: c.muted, fontWeight: '700', fontSize: 13 },
    numOn: { color: c.onGreen },
    label: { color: c.muted, fontSize: 12 },
    labelOn: { color: c.ink, fontWeight: '600' },
  })
