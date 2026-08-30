import { useMemo, type PropsWithChildren, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, type StyleProp, type TextInputProps, type ViewStyle, View } from 'react-native'
import { useColors } from '../store/theme'
import { useI18n } from '../store/i18n'
import { radius, spacing, type Colors } from '../theme'

export function Card({ children, onPress }: PropsWithChildren<{ onPress?: () => void }>) {
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const content = <View style={s.card}>{children}</View>
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button">{content}</Pressable> : content
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: { title: string; onPress: () => void; variant?: 'primary'|'outline'|'gold'; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useColors()
  const { t } = useI18n()
  const s = useMemo(() => makeStyles(c), [c])
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [s.button, variant === 'outline' && s.outline, variant === 'gold' && s.gold, (disabled || loading) && styles.disabled, pressed && !disabled && styles.pressed, style]}
    >
      <Text style={[s.buttonText, variant === 'outline' && s.outlineText, variant === 'gold' && s.goldText]}>
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
    card: { backgroundColor: c.white, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: c.border, gap: spacing.sm },
    button: { minHeight: 50, borderRadius: radius.sm, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
    buttonText: { color: c.onGreen, fontSize: 16, fontWeight: '800' },
    outline: { backgroundColor: c.white, borderWidth: 1.5, borderColor: c.green },
    outlineText: { color: c.green },
    gold: { backgroundColor: c.gold },
    goldText: { color: c.onGold },
    label: { color: c.ink, fontWeight: '700' },
    input: { minHeight: 52, backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, paddingHorizontal: 14, color: c.ink, fontSize: 16 },
    error: { color: c.danger, fontSize: 13 },
    sectionTitle: { fontSize: 21, fontWeight: '900', color: c.ink },
    muted: { color: c.muted, textAlign: 'center' },
    errorTitle: { color: c.ink, fontWeight: '900', fontSize: 18 },
  })

const styles = StyleSheet.create({
  disabled: { opacity: .45 },
  pressed: { transform: [{ scale: .98 }], opacity: .88 },
  field: { gap: spacing.xs },
  multiline: { minHeight: 110, paddingTop: 14, textAlignVertical: 'top' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { padding: spacing.xl, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
})
