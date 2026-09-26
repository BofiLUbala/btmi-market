import { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import Ionicons from '@expo/vector-icons/Ionicons'
import { authApi } from '../api'
import { ApiError, resolveMediaUrl } from '../api/client'
import { prepareAvatarUpload } from '../lib/imageUpload'
import { useAuth } from '../store/auth'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'

function avatarErrorKey(error?: ApiError) {
  if (!error) return 'profile.uploadFailedBody'
  if (error.code === 'IMAGE_TOO_LARGE') return 'profile.uploadTooLarge'
  if (error.code === 'INVALID_IMAGE_TYPE') return 'profile.uploadBadFormat'
  if (error.status === 401 || error.status === 403) return 'profile.uploadSessionExpired'
  return 'profile.uploadFailedBody'
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')

/** web: <AvatarUpload size={56}> — photo in a circle, initials on the accent
 *  tint when there is none, with a camera badge to replace it. */
export function AvatarPicker({ size, name }: { size: number; name: string }) {
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
      // TEMP diagnostic: surfaces the raw error while we track down a
      // production-only upload failure. `status` is 0 on a transport failure,
      // so it is stringified before the empty parts are dropped. Remove once
      // resolved.
      const debugDetail = apiError
        ? [String(apiError.status), apiError.code, apiError.detail].filter(Boolean).join(' ')
        : error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      if (__DEV__) console.warn('[TBK] avatar upload failed', debugDetail)
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
  const circle = { width: size, height: size, borderRadius: size / 2 }

  return (
    <Pressable onPress={onPress} disabled={uploading} style={circle} accessibilityRole="button" accessibilityLabel={t('profile.changePhoto')}>
      {avatarUrl ? (
        <Image source={resolveMediaUrl(avatarUrl)} style={[circle, { backgroundColor: colors.surfaceAlt }]} contentFit="cover" />
      ) : (
        <View style={[circle, styles.avatarPlaceholder, { backgroundColor: colors.goldSoft }]}>
          <Text style={{ color: colors.green, fontWeight: '800', fontSize: size * 0.36 }}>{initials(name) || '?'}</Text>
        </View>
      )}
      <View style={[styles.avatarBadge, { backgroundColor: colors.green, borderColor: colors.white }]}>
        <Ionicons name={uploading ? 'hourglass-outline' : 'camera'} size={11} color={colors.onGreen} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarBadge: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
})
