import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Location from 'expo-location'
import Ionicons from '@expo/vector-icons/Ionicons'
import { buyerApi } from '../src/api'
import { Button, ErrorState, Loading } from '../src/components/ui'
import { useI18n } from '../src/store/i18n'
import { useColors } from '../src/store/theme'
import { fonts, radius, shadow, spacing, type Colors } from '../src/theme'

/**
 * Reference 21 "Mes adresses". The backend stores one delivery address per
 * buyer (on /buyer/profile), so this lists that single address as the default
 * one; adding or changing it goes through the profile editor, and "Utiliser
 * ma position" saves the phone's GPS fix on the same profile.
 */
export default function AddressesScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const profile = useQuery({ queryKey: ['buyer', 'profile'], queryFn: buyerApi.profile })
  const [locError, setLocError] = useState('')

  const locate = useMutation({
    mutationFn: async () => {
      setLocError('')
      const permission = await Location.requestForegroundPermissionsAsync()
      if (!permission.granted) throw new Error(t('addresses.locationDenied'))
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      return buyerApi.updateProfile({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['buyer', 'profile'] }),
    onError: (e) => setLocError(e instanceof Error && e.message ? e.message : t('addresses.locationFailed')),
  })

  if (profile.isLoading) return <Loading label={t('profile.loading')} />
  if (profile.isError) return <ErrorState message={t('account.noAddress')} retry={() => void profile.refetch()} />

  const p = profile.data
  const hasAddress = Boolean(p?.street || p?.address || p?.commune)
  const line1 = [p?.street, p?.building_number].filter(Boolean).join(', ') || p?.address || ''
  const line2 = [p?.commune, p?.city, p?.province].filter(Boolean).join(', ')
  const hasGps = p?.latitude != null && p?.longitude != null

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.pageTitle} accessibilityRole="header">{t('addresses.title')}</Text>
        {/* Location panel */}
        <View style={styles.mapCard}>
          <View style={styles.mapPin}><Ionicons name="location" size={22} color={colors.onGreen} /></View>
          <Text style={styles.gpsText}>{hasGps ? `GPS: ${p!.latitude}, ${p!.longitude}` : t('account.noLocation')}</Text>
          <Pressable accessibilityRole="button" onPress={() => { if (!locate.isPending) locate.mutate() }} style={({ pressed }) => [styles.useLocation, pressed && { opacity: 0.85 }]}>
            <Ionicons name="add" size={16} color={colors.green} />
            <Text style={styles.useLocationText}>{locate.isPending ? t('addresses.locating') : t('addresses.useLocation')}</Text>
          </Pressable>
          {locate.isSuccess ? <Text style={styles.ok}>✓ {t('addresses.locationSaved')}</Text> : null}
          {locError ? <Text style={styles.err}>{locError}</Text> : null}
        </View>

        {hasAddress ? (
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: true }} onPress={() => router.push('/profile-edit')} style={[styles.card, styles.cardSelected]}>
            <View style={styles.pinTile}><Ionicons name="location" size={18} color={colors.onGreen} /></View>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>{p?.commune || t('addresses.main')}</Text>
                <View style={styles.defaultPill}><Text style={styles.defaultText}>{t('addresses.default')}</Text></View>
              </View>
              {line1 ? <Text style={styles.cardLine}>{line1}</Text> : null}
              {line2 ? <Text style={styles.cardLine}>{line2}</Text> : null}
              {p?.landmark ? <Text style={styles.cardLine}>{t('buyerProfile.landmark', { value: p.landmark })}</Text> : null}
            </View>
            <View style={styles.radioOn}><View style={styles.radioDot} /></View>
          </Pressable>
        ) : (
          <View style={styles.card}><Text style={styles.cardLine}>{t('account.noAddress')}</Text></View>
        )}

        <View style={styles.hint}>
          <Text style={styles.hintText}>{t('addresses.hint')}</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button title={hasAddress ? t('addresses.edit') : `+  ${t('addresses.add')}`} onPress={() => router.push('/profile-edit')} />
      </View>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.cream },
  page: { padding: spacing.md, gap: 12 },
  pageTitle: { color: c.ink, fontFamily: fonts.display, fontWeight: '700', fontSize: 22, letterSpacing: -0.3 },
  mapCard: { borderRadius: 18, backgroundColor: c.greenSoft, borderWidth: 1, borderColor: c.border, padding: spacing.md, alignItems: 'center', gap: 10, minHeight: 150, justifyContent: 'center' },
  mapPin: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.white, ...shadow.raised },
  gpsText: { color: c.muted, fontSize: 12 },
  useLocation: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.white, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14, ...shadow.card },
  useLocationText: { color: c.green, fontSize: 13, fontWeight: '700' },
  ok: { color: c.success, fontSize: 12, fontWeight: '700' },
  err: { color: c.danger, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: c.white, borderWidth: 1, borderColor: c.border, ...shadow.card },
  cardSelected: { borderColor: c.green, borderWidth: 1.5 },
  pinTile: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  cardTitle: { color: c.ink, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  defaultPill: { backgroundColor: c.greenSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  defaultText: { color: c.green, fontSize: 10.5, fontWeight: '700' },
  cardLine: { color: c.muted, fontSize: 12, lineHeight: 17 },
  radioOn: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.green, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.green },
  hint: { backgroundColor: c.warningSoft, borderRadius: radius.sm, padding: 12 },
  hintText: { color: c.warning, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  footer: { paddingHorizontal: spacing.md, paddingTop: 12, backgroundColor: c.white, borderTopWidth: 1, borderTopColor: c.border },
})
