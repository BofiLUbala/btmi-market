import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useI18n } from '../src/store/i18n'
import { useColors } from '../src/store/theme'
import { radius, spacing, type Colors } from '../src/theme'
import type { TranslationKey } from '../src/locales/fr'
import {
  enablePush,
  isExpoGo,
  notificationSettingsApi,
  presentLocal,
  pushState,
  releasePush,
  type NotificationCategory,
  type NotificationPreference,
  type PushDevice,
  type PushState,
} from '../src/lib/push'

type Space = 'buyer' | 'seller' | 'courier' | 'admin'

const CATEGORIES: Record<Space, NotificationCategory[]> = {
  buyer: ['ORDERS', 'PAYMENTS', 'MESSAGES', 'WATCHLIST', 'MARKETING', 'SECURITY'],
  seller: ['ORDERS', 'PAYMENTS', 'MESSAGES', 'SHOP', 'SECURITY'],
  courier: ['ORDERS', 'MESSAGES', 'SECURITY'],
  admin: ['ADMIN', 'MESSAGES', 'SECURITY'],
}
const AUDIENCE: Record<Space, string> = { buyer: 'BUYER', seller: 'SELLER', courier: 'COURIER', admin: 'ADMIN' }
const HOME: Record<Space, string> = { buyer: '/notifications', seller: '/seller/notifications', courier: '/courier', admin: '/admin' }

/** Notification settings for every space: /notification-settings?space=seller */
export default function NotificationSettingsScreen() {
  const { t } = useI18n()
  const tk = (key: string, vars?: Record<string, string | number>) => t(key as TranslationKey, vars)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const params = useLocalSearchParams<{ space?: string }>()
  const space: Space = (['buyer', 'seller', 'courier', 'admin'] as const).find((s) => s === params.space) ?? 'buyer'
  const scope = space === 'admin' ? 'admin' : 'user'

  const [prefs, setPrefs] = useState<NotificationPreference[] | null>(null)
  const [devices, setDevices] = useState<PushDevice[]>([])
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [p, d, s] = await Promise.all([
        notificationSettingsApi.preferences(scope),
        notificationSettingsApi.devices(scope),
        pushState(scope),
      ])
      setPrefs(p.items)
      setDevices(d.items)
      setState(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [scope])

  useEffect(() => { void load() }, [load])

  async function run(fn: () => Promise<void>, success?: string) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await fn()
      if (success) setMessage(success)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const update = (category: NotificationCategory, body: { push_enabled?: boolean; consent?: boolean }) =>
    run(async () => {
      const next = await notificationSettingsApi.update(scope, category, body)
      setPrefs((list) => list?.map((p) => (p.category === category ? next : p)) ?? null)
    }, tk('notifSettings.saved'))

  if (!prefs && !error) {
    return <View style={styles.center}><ActivityIndicator color={colors.ink} /></View>
  }

  const stateText: Record<PushState, string> = {
    on: tk('notifSettings.device.on'),
    off: tk('notifSettings.device.off'),
    denied: tk('notifSettings.device.denied'),
    'expo-go': tk('notifSettings.device.expoGo'),
    unavailable: tk('notifSettings.device.unavailable'),
    'other-account': tk('notifSettings.device.otherAccount'),
  }
  const shown = (prefs ?? [])
    .filter((p) => CATEGORIES[space].includes(p.category))
    .sort((a, b) => CATEGORIES[space].indexOf(a.category) - CATEGORIES[space].indexOf(b.category))

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.muted}>{tk('notifSettings.intro')}</Text>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!!message && <Text style={styles.success}>{message}</Text>}

      <View style={styles.card}>
        <Text style={styles.h2}>{tk('notifSettings.device.title')}</Text>
        {state && <Text style={state === 'on' ? styles.body : styles.muted}>{stateText[state]}</Text>}
        <View style={styles.actions}>
          {(state === 'off' || state === 'other-account') && (
            <Pressable accessibilityRole="button" disabled={busy} style={styles.primaryBtn}
              onPress={() => run(async () => { setState(await enablePush(scope)); await load() })}>
              <Text style={styles.primaryText}>{tk('notifSettings.device.enable')}</Text>
            </Pressable>
          )}
          {state === 'on' && (
            <Pressable accessibilityRole="button" disabled={busy} style={styles.secondaryBtn}
              onPress={() => run(() => notificationSettingsApi.test(scope, AUDIENCE[space]).then(() => undefined), tk('notifSettings.device.testSent'))}>
              <Text style={styles.secondaryText}>{tk('notifSettings.device.test')}</Text>
            </Pressable>
          )}
          {state === 'expo-go' && isExpoGo() && (
            // Remote push is impossible in Expo Go; a local alert still checks
            // what a tap opens.
            <Pressable accessibilityRole="button" disabled={busy} style={styles.secondaryBtn}
              onPress={() => run(async () => {
                await presentLocal(tk('notifSettings.device.test'), tk('notifSettings.device.testSent'), { app_link: HOME[space], kind: space === 'admin' ? 'ADMIN' : 'USER', audience: AUDIENCE[space] })
              })}>
              <Text style={styles.secondaryText}>{tk('notifSettings.device.test')}</Text>
            </Pressable>
          )}
          {state === 'on' && (
            <Pressable accessibilityRole="button" disabled={busy} style={styles.ghostBtn}
              onPress={() => run(async () => { await releasePush(scope); await load() })}>
              <Text style={styles.ghostText}>{tk('notifSettings.device.disable')}</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>{tk('notifSettings.categories.title')}</Text>
        {shown.map((p, i) => {
          const label = tk(`notifSettings.cat.${p.category}`)
          return (
            <View key={p.category} style={[styles.row, i > 0 && styles.rowBorder]}>
              <View style={styles.rowText}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.small}>
                  {tk(space === 'courier' && p.category === 'ORDERS' ? 'notifSettings.cat.ORDERS.courier' : `notifSettings.cat.${p.category}.desc`)}
                </Text>
                {p.locked && <Text style={styles.small}>{tk('notifSettings.locked')}</Text>}
                {p.requires_consent && (
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: p.consented }} disabled={busy}
                    style={styles.consent} onPress={() => update(p.category, { consent: !p.consented })}>
                    <View style={[styles.box, p.consented && styles.boxOn]}>{p.consented && <Text style={styles.tick}>✓</Text>}</View>
                    <Text style={styles.body}>{tk('notifSettings.consent')}</Text>
                  </Pressable>
                )}
                {p.requires_consent && (
                  <Text style={styles.small}>
                    {tk('notifSettings.consentNote', { cap: tk(p.category === 'WATCHLIST' ? 'notifSettings.cap.watchlist' : 'notifSettings.cap.marketing') })}
                  </Text>
                )}
              </View>
              <Switch
                accessibilityLabel={label}
                value={p.push_enabled}
                disabled={busy || p.locked || (p.requires_consent && !p.consented)}
                onValueChange={(v) => update(p.category, { push_enabled: v })}
              />
            </View>
          )
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>{tk('notifSettings.devices.title')}</Text>
        {devices.length === 0 ? (
          <Text style={styles.muted}>{tk('notifSettings.devices.empty')}</Text>
        ) : devices.map((d, i) => (
          <View key={d.id} style={[styles.row, i > 0 && styles.rowBorder]}>
            <View style={styles.rowText}>
              <Text style={styles.label}>{d.device_label || tk(d.platform === 'WEB' ? 'notifSettings.devices.web' : 'notifSettings.devices.app')}</Text>
              {d.last_success_at && (
                <Text style={styles.small}>{tk('notifSettings.devices.lastSuccess', { date: new Date(d.last_success_at).toLocaleString('fr-FR') })}</Text>
              )}
            </View>
            <Pressable accessibilityRole="button" disabled={busy}
              onPress={() => run(async () => { await notificationSettingsApi.removeDevice(scope, d.id); await load() })}>
              <Text style={styles.ghostText}>{tk('notifSettings.devices.remove')}</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.cream },
    content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
    card: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.xs },
    h2: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 4 },
    body: { fontSize: 14, color: colors.ink },
    muted: { fontSize: 14, color: colors.muted },
    small: { fontSize: 12, color: colors.muted },
    label: { fontSize: 15, fontWeight: '600', color: colors.ink },
    error: { color: colors.danger, fontSize: 14 },
    success: { color: colors.success, fontSize: 14 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
    primaryBtn: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: 18 },
    primaryText: { color: colors.white, fontWeight: '700' },
    secondaryBtn: { borderWidth: 1, borderColor: colors.borderControl, borderRadius: radius.pill, paddingVertical: 11, paddingHorizontal: 16 },
    secondaryText: { color: colors.ink, fontWeight: '600' },
    ghostBtn: { paddingVertical: 11, paddingHorizontal: 8 },
    ghostText: { color: colors.danger, fontWeight: '600' },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    rowText: { flex: 1, gap: 3 },
    consent: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, minHeight: 32 },
    box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.borderControl, alignItems: 'center', justifyContent: 'center' },
    boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
    tick: { color: colors.white, fontSize: 13, fontWeight: '800' },
  })
