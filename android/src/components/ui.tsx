import type { PropsWithChildren, ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, type StyleProp, type TextInputProps, type ViewStyle, View } from 'react-native'
import { colors, radius, spacing } from '../theme'

export function Card({ children, onPress }: PropsWithChildren<{ onPress?: () => void }>) {
  const content = <View style={styles.card}>{children}</View>
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button">{content}</Pressable> : content
}
export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: { title: string; onPress: () => void; variant?: 'primary'|'outline'|'gold'; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  return <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.button, variant === 'outline' && styles.outline, variant === 'gold' && styles.gold, (disabled || loading) && styles.disabled, pressed && !disabled && styles.pressed, style]}><Text style={[styles.buttonText, variant === 'outline' && styles.outlineText]}>{loading ? 'Un instant…' : title}</Text></Pressable>
}
export function Field(props: TextInputProps & { label: string; error?: string }) {
  return <View style={styles.field}><Text style={styles.label}>{props.label}</Text><TextInput placeholderTextColor={colors.mutedLight} {...props} style={[styles.input, props.multiline && styles.multiline]} />{props.error ? <Text style={styles.error}>{props.error}</Text> : null}</View>
}
export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) { return <View style={styles.sectionHead}><Text style={styles.sectionTitle}>{title}</Text>{action}</View> }
export function Loading({ label = 'Chargement…' }: { label?: string }) { return <View style={styles.center}><ActivityIndicator color={colors.green} size="large"/><Text style={styles.muted}>{label}</Text></View> }
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <View style={styles.center}><Text style={styles.errorTitle}>Impossible de charger</Text><Text style={styles.muted}>{message}</Text>{retry && <Button title="Réessayer" onPress={retry}/>}</View> }

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  button: { minHeight: 50, borderRadius: radius.sm, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  outline: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.green }, outlineText: { color: colors.green }, gold: { backgroundColor: colors.gold }, disabled: { opacity: .45 }, pressed: { transform: [{ scale: .98 }], opacity: .88 },
  field: { gap: spacing.xs }, label: { color: colors.ink, fontWeight: '700' }, input: { minHeight: 52, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 14, color: colors.ink, fontSize: 16 }, multiline: { minHeight: 110, paddingTop: 14, textAlignVertical: 'top' },
  error: { color: colors.danger, fontSize: 13 }, sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { fontSize: 21, fontWeight: '900', color: colors.ink },
  center: { padding: spacing.xl, alignItems: 'center', justifyContent: 'center', gap: spacing.md }, muted: { color: colors.muted, textAlign: 'center' }, errorTitle: { color: colors.ink, fontWeight: '900', fontSize: 18 },
})
