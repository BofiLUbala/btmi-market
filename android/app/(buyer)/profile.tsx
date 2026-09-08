import { useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { buyerApi, authApi } from '../../src/api'
import { ApiError, resolveMediaUrl } from '../../src/api/client'
import { prepareAvatarUpload } from '../../src/lib/imageUpload'
import { useAuth } from '../../src/store/auth'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { Button, Card, Loading, SectionTitle } from '../../src/components/ui'
import { PreferenceToggles } from '../../src/components/PreferenceToggles'
import { spacing, type Colors } from '../../src/theme'
import { canSell, canOnboardSeller } from '../../src/types'

const AVATAR_SIZE = 88

function avatarErrorKey(error?: ApiError) {
  if (!error) return 'profile.uploadFailedBody'
  if (error.code === 'IMAGE_TOO_LARGE') return 'profile.uploadTooLarge'
  if (error.code === 'INVALID_IMAGE_TYPE') return 'profile.uploadBadFormat'
  if (error.status === 401 || error.status === 403) return 'profile.uploadSessionExpired'
  return 'profile.uploadFailedBody'
}

function AvatarPicker() {
  const user = useAuth((state) => state.user)
  const refresh = useAuth((state) => state.refresh)
  const { t } = useI18n()
  const colors = useColors()
  const [uploading, setUploading] = useState(false)

  async function uploadFromAsset(asset: ImagePicker.ImagePickerAsset) {
    setUploading(true)
    try {
      await authApi.uploadAvatar(await prepareAvatarUpload(asset))
      await refresh()
    } catch (error) {
      const apiError = error instanceof ApiError ? error : undefined
      if (__DEV__) console.warn('[TBK] avatar upload failed', apiError ? `${apiError.status} ${apiError.code}` : error)
      // TEMP diagnostic: surfaces the raw error while we track down a
      // production-only upload failure. Remove once resolved.
      const debugDetail = apiError ? `${apiError.status} ${apiError.code}` : error instanceof Error ? error.message : String(error)
      Alert.alert(t('profile.uploadFailed'), `${t(avatarErrorKey(apiError))}\n\n[debug] ${debugDetail}`)
    } finally {
      setUploading(false)
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(t('profile.cameraNeeded'), t('profile.cameraNeededBody'))
      return
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 })
    if (result.canceled || !result.assets[0]) return
    await uploadFromAsset(result.assets[0])
  }

  async function pickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(t('profile.photosNeeded'), t('profile.photosNeededBody'))
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8, selectionLimit: 1 })
    if (result.canceled || !result.assets[0]) return
    await uploadFromAsset(result.assets[0])
  }

  function onPress() {
    Alert.alert(t('profile.photoTitle'), undefined, [
      { text: t('profile.takePhoto'), onPress: takePhoto },
      { text: t('profile.chooseFromGallery'), onPress: pickFromLibrary },
      { text: t('common.cancel'), style: 'cancel' },
    ])
  }

  const avatarUrl = user?.avatar_url

  return (
    <Pressable
      onPress={onPress}
      disabled={uploading}
      style={styles.avatarWrap}
      accessibilityRole="button"
      accessibilityLabel={t('profile.changePhoto')}
    >
      {avatarUrl ? (
        <Image source={resolveMediaUrl(avatarUrl)} style={[styles.avatarImage, { backgroundColor: colors.surfaceAlt }]} contentFit="cover" />
      ) : (
        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="person" size={AVATAR_SIZE * 0.5} color={colors.mutedLight} />
        </View>
      )}
      <View style={[styles.avatarBadge, { backgroundColor: colors.green, borderColor: colors.white }]}>
        <Ionicons
          name={uploading ? 'hourglass-outline' : 'camera'}
          size={14}
          color={colors.onGreen}
        />
      </View>
    </Pressable>
  )
}

export default function ProfileScreen() {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const { t } = useI18n()
  const colors = useColors()
  const themed = useMemo(() => makeStyles(colors), [colors])
  const profile = useQuery({ queryKey: ['buyer', 'profile'], queryFn: buyerApi.profile, enabled: Boolean(user) && user?.account_type !== 'EMPLOYEE' })
  const becomeSeller = useMutation({ mutationFn: authApi.becomeSeller, onSuccess: async () => { await useAuth.getState().refresh(); router.push('/seller/onboarding') }, onError: () => Alert.alert(t('common.error'), t('seller.becomeFailed')) })

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={themed.title}>{t('profile.yourAccount')}</Text>
        <Text style={themed.muted}>{t('profile.signInPrompt')}</Text>
        <Button title={t('common.signIn')} onPress={() => router.push('/auth/login')} />
        <Button title={t('auth.createAccount')} variant="outline" onPress={() => router.push('/auth/register-choice')} />
        <PreferenceToggles />
      </View>
    )
  }

  if (profile.isLoading && user.account_type !== 'EMPLOYEE') return <Loading label={t('profile.loading')} />

  const p = profile.data

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <AvatarPicker />
        <View style={styles.headerText}>
          <SectionTitle title={`${p?.first_name || user.first_name} ${p?.last_name || user.last_name}`} />
          <Text style={themed.muted}>{user.email}</Text>
        </View>
      </View>

      <SectionTitle title={t('profile.accountsTitle')} />
      <Card>
        <View style={styles.accountHeading}>
          <View style={[styles.accountIcon, { backgroundColor: colors.greenSoft }]}>
            <Ionicons name="bag-handle-outline" size={24} color={colors.green} />
          </View>
          <View style={styles.accountCopy}>
            <Text style={themed.accountTitle}>{t('profile.buyerAccount')}</Text>
            <Text style={themed.muted}>{t('profile.buyerAccountActive')}</Text>
          </View>
          <Ionicons name="checkmark-circle" size={25} color={colors.green} />
        </View>
        <Button title={t('profile.openMarketplace')} variant="outline" onPress={() => router.push('/(buyer)')} />
      </Card>

      <Card>
        <View style={styles.accountHeading}>
          <View style={[styles.accountIcon, { backgroundColor: colors.goldSoft }]}>
            <Ionicons name="storefront-outline" size={24} color={colors.gold} />
          </View>
          <View style={styles.accountCopy}>
            <Text style={themed.accountTitle}>{t('profile.sellerAccount')}</Text>
            <Text style={themed.muted}>
              {canSell(user) ? t('profile.sellerAccountActive') : canOnboardSeller(user) ? t('profile.sellerAccountPending') : t('profile.sellerAccountInactive')}
            </Text>
          </View>
          {canSell(user) ? <Ionicons name="checkmark-circle" size={25} color={colors.green} /> : null}
        </View>
        {canSell(user) ? (
          <Button title={t('profile.openSellerSpace')} variant="gold" onPress={() => router.push('/seller')} />
        ) : canOnboardSeller(user) ? (
          <Button title={t('seller.finishSetup')} variant="gold" onPress={() => router.push('/seller/onboarding')} />
        ) : (
          <Button title={t('profile.createSellerAccount')} variant="gold" loading={becomeSeller.isPending} onPress={() => becomeSeller.mutate()} />
        )}
      </Card>

      <Card>
        <Text style={themed.eyebrow}>{t('profile.contact')}</Text>
        <Text style={themed.value}>{p?.phone || t('profile.noPhone')}</Text>
        <Text style={themed.value}>{p?.backup_phone || t('profile.noBackupPhone')}</Text>
      </Card>

      <Card>
        <Text style={themed.eyebrow}>{t('profile.address')}</Text>
        <Text style={themed.value}>{p?.address || t('profile.noAddress')}</Text>
        <Text style={themed.muted}>{[p?.commune, p?.city, p?.country].filter(Boolean).join(', ') || t('profile.noLocation')}</Text>
        {p?.latitude != null && p?.longitude != null && (
          <Text style={[themed.muted, { fontSize: 13, marginTop: 4 }]}>
            📍 GPS: {p.latitude}, {p.longitude}
          </Text>
        )}
      </Card>

      <Button variant="outline" title={t('profile.editProfile')} onPress={() => router.push('/profile-edit')} />

      <Card>
        <Pressable onPress={() => router.push('/orders')}><Text style={themed.item}>{t('profile.myOrders')}  ›</Text></Pressable>
        <Text style={themed.item}>{t('profile.myPoints')}</Text>
        <Pressable onPress={() => router.push('/reviews')}><Text style={themed.item}>{t('profile.myReviews')}  ›</Text></Pressable>
      </Card>

      <SectionTitle title={t('prefs.title')} />
      <PreferenceToggles />

      <Button variant="outline" title={t('common.signOut')} onPress={async () => { await logout(); router.replace('/(buyer)') }} />
    </ScrollView>
  )
}

/** Colour-bearing styles are rebuilt per theme; layout-only rules stay static
 *  in `styles` below so they are created once. */
const makeStyles = (c: Colors) =>
  StyleSheet.create({
    title: { fontSize: 25, fontWeight: '900', color: c.ink, textAlign: 'center' },
    muted: { color: c.muted },
    eyebrow: { color: c.gold, fontWeight: '900', fontSize: 12 },
    value: { color: c.ink, fontWeight: '700', fontSize: 16 },
    item: { color: c.ink, fontWeight: '800', fontSize: 17, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.border },
    accountTitle: { color: c.ink, fontWeight: '900', fontSize: 17 },
  })

const styles = StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: 2 },
  accountHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  accountIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  accountCopy: { flex: 1, gap: 3 },
  avatarWrap: { width: AVATAR_SIZE, height: AVATAR_SIZE },
  avatarImage: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatarPlaceholder: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
})
