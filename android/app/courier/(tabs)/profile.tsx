import { useMemo } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { courierApi } from '../../../src/api'
import { AvatarPicker } from '../../../src/components/AvatarPicker'
import { CourierHeader, IconDisc, useCourierHeaderColors } from '../../../src/components/CourierUI'
import { useAuth } from '../../../src/store/auth'
import { useI18n, type TranslationKey } from '../../../src/store/i18n'
import { useColors } from '../../../src/store/theme'
import { fonts, radius, shadow, spacing, type Colors } from '../../../src/theme'
import { cashLabel, kinshasaToday } from '../../../src/lib/courier'

/** Known transport types in the courier's words; anything else is shown as stored. */
const TRANSPORT_KEYS: Record<string, TranslationKey> = {
  MOTO: 'courierUi.transport.MOTO',
  MOTORCYCLE: 'courierUi.transport.MOTO',
  BICYCLE: 'courierUi.transport.BICYCLE',
  BIKE: 'courierUi.transport.BICYCLE',
  CAR: 'courierUi.transport.CAR',
  VAN: 'courierUi.transport.VAN',
  FOOT: 'courierUi.transport.FOOT',
}

/** Courier profile (reference "Écran Profil"): GET /courier/profile and the signed-in account. */
export default function CourierProfileScreen() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const header = useCourierHeaderColors()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const profile = useQuery({ queryKey: ['courier', 'profile'], queryFn: courierApi.profile, retry: false })
  const earnings = useQuery({ queryKey: ['courier', 'earnings', kinshasaToday()], queryFn: () => courierApi.earnings(kinshasaToday()) })

  const p = profile.data
  const name = [p?.first_name || user?.first_name, p?.last_name || user?.last_name].filter(Boolean).join(' ')
  const transport = p?.transport_type ? (TRANSPORT_KEYS[p.transport_type.toUpperCase()] ? t(TRANSPORT_KEYS[p.transport_type.toUpperCase()]) : p.transport_type) : ''
  const vehicle = [transport, p?.service_zone].filter(Boolean).join(' – ') || t('courierUi.profile.notSet')
  const settings = () => router.push({ pathname: '/notification-settings', params: { space: 'courier' } })

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={profile.isRefetching} onRefresh={() => { void profile.refetch(); void queryClient.invalidateQueries({ queryKey: ['courier', 'earnings'] }) }} />}
    >
      <CourierHeader
        overlap={40}
        right={(
          <Pressable accessibilityRole="button" accessibilityLabel={t('courierUi.profile.settings')} hitSlop={8} onPress={settings} style={[styles.gear, { backgroundColor: header.chip }]}>
            <Ionicons name="settings-outline" size={21} color={header.ink} />
          </Pressable>
        )}
      >
        <View style={styles.identity}>
          <View style={[styles.avatarRing, { borderColor: header.ink }]}>
            <AvatarPicker size={84} name={name || user?.email || ''} />
          </View>
          <Text style={[styles.name, { color: header.ink }]} numberOfLines={1}>{name || '—'}</Text>
          <Text style={[styles.role, { color: header.soft }]}>{t('courierUi.profile.role')}</Text>
        </View>
      </CourierHeader>

      <View style={styles.body}>
        <View style={styles.stats}>
          <Stat value={p ? String(p.total_deliveries ?? 0) : '…'} label={t('courierUi.profile.deliveries')} />
          <View style={styles.statDivider} />
          <Stat value={p ? String(earnings.data?.orders_delivered ?? p.completed_today ?? 0) : '…'} label={t('courierUi.profile.today')} />
          <View style={styles.statDivider} />
          <Stat value={earnings.isLoading ? '…' : earnings.isError ? '—' : cashLabel(earnings.data)} label={t('courierUi.profile.cashToday')} />
        </View>

        <View style={styles.list}>
          <Item icon="person-outline" title={t('courierUi.profile.myInfo')} onPress={() => router.push('/profile-edit')} />
          <Item icon="bicycle-outline" title={t('courierUi.profile.vehicle')} subtitle={vehicle} />
          <Item icon="settings-outline" title={t('courierUi.profile.settings')} subtitle={t('courierUi.profile.settingsBody')} onPress={settings} />
          <Item icon="headset-outline" title={t('courierUi.assistance.title')} onPress={() => router.push('/courier/assistance')} />
          <Item icon="log-out-outline" title={t('courierUi.profile.logout')} danger last onPress={async () => { await logout(); router.replace('/auth/login') }} />
        </View>
      </View>
    </ScrollView>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  )
}

/** Without `onPress` the row is read-only (no chevron). */
function Item({ icon, title, subtitle, onPress, danger, last }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; onPress?: () => void; danger?: boolean; last?: boolean }) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const content = (
    <>
      <IconDisc name={icon} size={36} colors={colors} tone={danger ? 'danger' : 'blue'} />
      <View style={styles.itemText}>
        <Text style={[styles.itemTitle, danger && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={styles.itemSub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {onPress && !danger ? <Ionicons name="chevron-forward" size={18} color={colors.mutedLight} /> : null}
    </>
  )
  return onPress
    ? <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.item, !last && styles.divider, pressed && { backgroundColor: colors.surface2 }]}>{content}</Pressable>
    : <View style={[styles.item, !last && styles.divider]}>{content}</View>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { paddingBottom: spacing.xl, backgroundColor: c.cream, flexGrow: 1 },
  gear: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  identity: { alignItems: 'center', gap: 4, marginTop: -spacing.lg },
  avatarRing: { borderWidth: 3, borderRadius: 26, padding: 2 },
  name: { fontFamily: fonts.display, fontWeight: '700', fontSize: 22, marginTop: spacing.xs },
  role: { fontWeight: '600', fontSize: 14 },
  body: { paddingHorizontal: spacing.md, gap: spacing.md, marginTop: -40 },
  stats: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.white, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, paddingVertical: spacing.md, ...shadow.card },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: spacing.xs },
  statValue: { color: c.green, fontFamily: fonts.display, fontWeight: '700', fontSize: 19 },
  statLabel: { color: c.muted, fontSize: 12 },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: c.border },
  list: { backgroundColor: c.white, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.md, ...shadow.card },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, paddingVertical: spacing.sm + 2, minHeight: 56 },
  divider: { borderBottomWidth: 1, borderBottomColor: c.border },
  itemText: { flex: 1, minWidth: 0 },
  itemTitle: { color: c.ink, fontWeight: '700', fontSize: 15 },
  itemSub: { color: c.muted, fontSize: 12.5, marginTop: 1 },
})
