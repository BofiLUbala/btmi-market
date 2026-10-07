import { useMemo, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useColors } from '../store/theme'
import { useI18n, type TranslationKey } from '../store/i18n'
import { radius, shadow, spacing, type Colors } from '../theme'
import { Button } from './ui'

const PRESETS: Record<'buyer' | 'seller', TranslationKey[]> = {
  buyer: ['cancelReason.buyer1', 'cancelReason.buyer2', 'cancelReason.buyer3', 'cancelReason.buyer4'],
  seller: ['cancelReason.seller1', 'cancelReason.seller2', 'cancelReason.seller3', 'cancelReason.seller4'],
}

/**
 * Asks why an order is cancelled (buyer or seller) or refused (seller). The
 * reason is required by the API and shown to everyone on the order. Pick a
 * suggestion or write one; `onConfirm` receives the final text.
 */
export function CancelReasonSheet({ visible, side, kind = 'cancel', note, busy, onConfirm, onClose }: {
  visible: boolean
  side: 'buyer' | 'seller'
  kind?: 'cancel' | 'reject'
  /** What happens next (stock, courier, return), shown above the reasons. */
  note?: string
  busy?: boolean
  onConfirm: (reason: string) => void
  onClose: () => void
}) {
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const { t } = useI18n()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const confirm = () => {
    const value = reason.trim()
    if (value.length < 3) { setError(t('cancelReason.required')); return }
    setError('')
    onConfirm(value)
  }
  const close = () => { setReason(''); setError(''); onClose() }

  if (!visible) return null
  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <View style={s.backdrop}>
        <View style={s.card} accessibilityRole="alert">
          <Text style={s.title}>{t(kind === 'reject' ? 'cancelReason.titleReject' : 'cancelReason.titleCancel')}</Text>
          {note ? <Text style={s.note}>{note}</Text> : null}
          <Text style={s.intro}>{t('cancelReason.intro')}</Text>
          <View style={s.chips}>
            {PRESETS[side].map((key) => {
              const label = t(key)
              const on = reason === label
              return <Pressable key={key} onPress={() => { setReason(label); setError('') }} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.chip, on && s.chipOn]}>
                <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
              </Pressable>
            })}
          </View>
          <TextInput
            value={reason}
            onChangeText={(v) => { setReason(v); if (error) setError('') }}
            placeholder={t('cancelReason.placeholder')}
            placeholderTextColor={c.mutedLight}
            multiline
            maxLength={500}
            accessibilityLabel={t('cancellation.reason')}
            style={s.input}
          />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Button title={t(kind === 'reject' ? 'cancelReason.confirmReject' : 'cancelReason.confirmCancel')} onPress={confirm} loading={busy} />
          <Pressable onPress={close} accessibilityRole="button" style={s.back} disabled={busy}>
            <Text style={s.backText}>{t('orders.back')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(6, 12, 28, 0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 460, backgroundColor: c.white, borderRadius: radius.lg, padding: spacing.lg, gap: 12, ...shadow.raised },
  title: { color: c.ink, fontSize: 19, fontWeight: '800' },
  intro: { color: c.muted, fontSize: 14, lineHeight: 20 },
  note: { color: c.ink, fontSize: 14, lineHeight: 20, backgroundColor: c.warningSoft, borderRadius: radius.sm, padding: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.white },
  chipOn: { backgroundColor: c.greenSoft, borderColor: c.green },
  chipText: { color: c.ink, fontSize: 13.5, fontWeight: '600' },
  chipTextOn: { color: c.green },
  input: { minHeight: 84, borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, padding: 12, color: c.ink, fontSize: 15, textAlignVertical: 'top', backgroundColor: c.surface2 },
  error: { color: c.danger, fontSize: 13.5, fontWeight: '600' },
  back: { alignItems: 'center', paddingVertical: 10 },
  backText: { color: c.muted, fontSize: 15, fontWeight: '600' },
})
