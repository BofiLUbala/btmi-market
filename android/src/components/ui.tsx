import { useMemo, type PropsWithChildren, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, type StyleProp, type TextInputProps, type ViewStyle, View } from 'react-native'
import { useColors } from '../store/theme'
import { useI18n } from '../store/i18n'
import { fonts, radius, shadow, spacing, type Colors } from '../theme'

export function Card({ children, onPress }: PropsWithChildren<{ onPress?: () => void }>) {
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const content = <View style={s.card}>{children}</View>
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button">{content}</Pressable> : content
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, style, dense }: { title: string; onPress: () => void; variant?: 'primary'|'outline'|'gold'; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>; dense?: boolean }) {
  const c = useColors()
  const { t } = useI18n()
  const s = useMemo(() => makeStyles(c), [c])
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [s.button, dense && s.buttonDense, variant === 'outline' && s.outline, variant === 'gold' && s.gold, (disabled || loading) && styles.disabled, pressed && !disabled && styles.pressed, style]}
    >
      {/* Long labels in narrow spots shrink a little instead of being cut. */}
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[s.buttonText, dense && s.buttonTextDense, variant === 'outline' && s.outlineText, variant === 'gold' && s.goldText]}>
        {loading ? t('common.oneMoment') : title}
      </Text>
    </Pressable>
  )
}

export function Field(props: TextInputProps & { label: string; error?: string }) {
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.field}>
      <Text style={s.label}>{props.label}</Text>
      <TextInput placeholderTextColor={c.mutedLight} {...props} style={[s.input, props.multiline && styles.multiline]} />
      {props.error ? <Text style={s.error}>{props.error}</Text> : null}
    </View>
  )
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  return <View style={styles.sectionHead}><Text style={s.sectionTitle}>{title}</Text>{action}</View>
}

export function Loading({ label }: { label?: string }) {
  const c = useColors()
  const { t } = useI18n()
  const s = useMemo(() => makeStyles(c), [c])
  return <View style={styles.center}><ActivityIndicator color={c.green} size="large"/><Text style={s.muted}>{label ?? t('common.loading')}</Text></View>
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  const c = useColors()
  const { t } = useI18n()
  const s = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.center}>
      <Text style={s.errorTitle}>{t('common.cannotLoad')}</Text>
      <Text style={s.muted}>{message}</Text>
      {retry && <Button title={t('common.retry')} onPress={retry}/>}
    </View>
  )
}

/** Colour-bearing styles are rebuilt whenever the palette changes; the purely
 *  structural ones live in `styles` and are created once. */
const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: { backgroundColor: c.white, borderRadius: 18, padding: spacing.md, borderWidth: 1, borderColor: c.border, gap: spacing.sm, ...shadow.card },
    button: { minHeight: 52, borderRadius: 14, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
    buttonText: { color: c.onGreen, fontSize: 15, fontWeight: '700', letterSpacing: 0.1 },
    buttonDense: { minHeight: 44, paddingHorizontal: spacing.sm },
    buttonTextDense: { fontSize: 14 },
    outline: { backgroundColor: c.white, borderWidth: 1.5, borderColor: c.green },
    outlineText: { color: c.green },
    gold: { backgroundColor: c.gold },
    goldText: { color: c.onGold },
    label: { color: c.ink, fontWeight: '600', fontSize: 13 },
    input: { minHeight: 50, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.borderControl, borderRadius: radius.sm, paddingHorizontal: 14, color: c.ink, fontSize: 15 },
    error: { color: c.danger, fontSize: 13 },
    sectionTitle: { fontSize: 18, fontFamily: fonts.display, fontWeight: '700', color: c.ink, letterSpacing: -0.3 },
    muted: { color: c.muted, textAlign: 'center' },
    errorTitle: { color: c.ink, fontFamily: fonts.display, fontWeight: '700', fontSize: 18 },
  })

const styles = StyleSheet.create({
  disabled: { opacity: .45 },
  pressed: { transform: [{ scale: .98 }], opacity: .88 },
  field: { gap: spacing.xs },
  multiline: { minHeight: 110, paddingTop: 14, textAlignVertical: 'top' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { padding: spacing.xl, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
})
