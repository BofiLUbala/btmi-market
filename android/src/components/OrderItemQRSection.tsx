import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useQuery } from '@tanstack/react-query'
import { API_URL, ApiError } from '../api/client'
import { tokenStore } from '../api/tokenStore'
import { useI18n, type TranslationKey } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, type Colors } from '../theme'
import type { OrderItemQR } from '../types'

export type LabelField = { label: string; value: string }

/** Same mapping as web-app/src/lib/qrErrors.ts orderItemQRErrorKey. */
export function orderItemQRErrorKey(error: unknown, opts: { scanned?: boolean } = {}): TranslationKey {
  const code = error instanceof ApiError ? error.code : ''
  switch (code) {
    case 'QR_INVALID': return opts.scanned ? 'itemQr.error.wrongKind' : 'itemQr.error.invalid'
    case 'QR_FORBIDDEN': case 'QR_WRONG_COURIER': case 'FORBIDDEN': return 'itemQr.error.forbidden'
    case 'QR_NOT_READY': case 'NOT_FOUND': return 'itemQr.error.notFound'
    case 'NETWORK_ERROR': case 'REQUEST_TIMEOUT': return 'itemQr.error.network'
    default: return 'itemQr.error.generic'
  }
}

/** Port of web's QRPanel: the backend-rendered PNG (fetched with the session
 *  token, like web's authenticatedBlob), the reference and the label fields. */
export function QRPanel({ qr, imagePath, title, fields = [] }: { qr: { reference: string; status?: string }; imagePath: string; title: string; fields?: LabelField[] }) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const token = useQuery({ queryKey: ['auth', 'accessToken'], queryFn: () => tokenStore.getAccess(), staleTime: 60_000 })
  return <View style={styles.panel}>
    <Text style={styles.brand}>TBK</Text>
    <Text style={styles.title}>{title.toUpperCase()}</Text>
    {token.data ? <Image source={{ uri: `${API_URL}${imagePath}`, headers: { Authorization: `Bearer ${token.data}` } }} style={styles.image} contentFit="contain" accessibilityLabel={qr.reference} /> : <View style={styles.image} />}
    <Text style={styles.ref} selectable>{qr.reference}</Text>
    {fields.filter((f) => f.value).map((f) => <View key={f.label} style={styles.fieldRow}><Text style={styles.fieldLabel}>{f.label}</Text><Text style={styles.fieldValue}>{f.value}</Text></View>)}
  </View>
}

/**
 * Port of web-app/src/components/qr/OrderItemQRSection.tsx: the per-order-item
 * QR of one line with its four states (loading, ready, empty, error + retry).
 * Seller and buyer each pass their own role-specific loader and image path.
 */
export function OrderItemQRSection({ load, imagePath, instruction, fields = [], title }: { load: () => Promise<OrderItemQR>; imagePath: string; instruction: string; fields?: LabelField[]; title?: string }) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [qr, setQr] = useState<OrderItemQR | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [message, setMessage] = useState('')

  const fetchQR = useCallback((cancelled?: () => boolean) => {
    setState('loading')
    setMessage('')
    return load()
      .then((value) => {
        if (cancelled?.()) return
        if (!value?.reference) { setState('empty'); return }
        setQr(value)
        setState('ready')
      })
      .catch((error: unknown) => {
        if (cancelled?.()) return
        setMessage(t(orderItemQRErrorKey(error)))
        setState('error')
      })
  }, [load, t])

  useEffect(() => {
    let cancelled = false
    void fetchQR(() => cancelled)
    return () => { cancelled = true }
  }, [fetchQR])

  if (state === 'loading') return <View style={styles.card}><Text style={styles.muted}>{t('itemQr.loading')}</Text></View>
  if (state === 'empty') return <View style={styles.card}><Text style={styles.muted}>{t('itemQr.empty')}</Text></View>
  if (state === 'error' || !qr) return <View style={styles.card} accessibilityRole="alert">
    <Text style={styles.text}>{message || t('itemQr.error.generic')}</Text>
    <Pressable accessibilityRole="button" onPress={() => void fetchQR()} style={styles.retry}><Text style={styles.retryText}>{t('itemQr.retry')}</Text></Pressable>
  </View>
  return <View>
    <QRPanel qr={qr} imagePath={imagePath} title={title ?? t('itemQr.title')} fields={fields} />
    <Text style={[styles.muted, { marginTop: 6, textAlign: 'center' }]}>{instruction}</Text>
  </View>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  card: { marginTop: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.white },
  muted: { color: c.muted, fontSize: 14 },
  text: { color: c.ink, fontSize: 14 },
  retry: { marginTop: 8, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: c.green },
  retryText: { color: c.green, fontWeight: '600' },
  panel: { marginTop: 12, alignItems: 'center', gap: 4, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: '#FFFFFF' },
  brand: { fontSize: 20, fontWeight: '800', letterSpacing: 3, color: '#000000' },
  title: { fontSize: 11, letterSpacing: 1, color: '#000000', marginBottom: 6 },
  image: { width: 180, height: 180 },
  ref: { fontFamily: 'monospace', fontSize: 13, fontWeight: '700', color: '#000000', marginTop: 4 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', gap: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#000000' },
  fieldValue: { fontSize: 11, color: '#000000', flexShrink: 1, textAlign: 'right' },
})
