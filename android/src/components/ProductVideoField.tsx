import { useMemo, useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { File } from 'expo-file-system'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { confirmAction } from '../lib/confirmAction'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { spacing, type Colors } from '../theme'
import type { UploadFile } from '../lib/imageUpload'

/** Same caps as the API (`maxProductVideoBytes` in product_video_service.go). */
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024
export const MAX_VIDEO_SECONDS = 60
/** Filming stops by itself: a phone camera writes roughly 1-2 MB per second. */
export const RECORD_VIDEO_SECONDS = 30

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp']

export interface PickedVideo extends UploadFile {
  name: string
  sizeBytes: number
  seconds?: number
}

/** What the field shows as the current video: a freshly picked one or the one already saved. */
export interface VideoSummary { name: string; sizeBytes?: number }

const megabytes = (bytes?: number) => bytes ? `${(bytes / (1024 * 1024)).toFixed(1)} Mo` : ''

/** Optional explainer video for a product: filmed on the spot or picked from the
 *  gallery. It sits beside the photo slots and never touches them. */
export function ProductVideoField({ current, busy, onPicked, onRemove }: {
  current: VideoSummary | null
  busy?: boolean
  onPicked: (video: PickedVideo) => void
  onRemove: () => void
}) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [reading, setReading] = useState(false)
  const disabled = busy || reading

  async function pick(source: 'camera' | 'library') {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      confirmAction(
        t(source === 'camera' ? 'profile.cameraNeeded' : 'profile.photosNeeded'),
        t(source === 'camera' ? 'profile.cameraNeededBody' : 'profile.photosNeededBody'),
      )
      return
    }
    setReading(true)
    try {
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: RECORD_VIDEO_SECONDS })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], selectionLimit: 1 })
      if (result.canceled || !result.assets[0]) return
      const asset = result.assets[0]

      const type = asset.mimeType ?? 'video/mp4'
      if (!ALLOWED_VIDEO_TYPES.includes(type)) { confirmAction(t('seller.productForm.video.invalidType')); return }
      // The picker reports the duration in milliseconds.
      const seconds = asset.duration ? Math.round(asset.duration / 1000) : undefined
      if (seconds && seconds > MAX_VIDEO_SECONDS) { confirmAction(t('seller.productForm.video.tooLong', { seconds: MAX_VIDEO_SECONDS })); return }
      let sizeBytes = asset.fileSize ?? 0
      if (!sizeBytes) {
        try { sizeBytes = new File(asset.uri).size ?? 0 } catch { sizeBytes = 0 }
      }
      if (sizeBytes > MAX_VIDEO_BYTES) { confirmAction(t('seller.productForm.video.tooLarge', { size: MAX_VIDEO_BYTES / (1024 * 1024) })); return }

      onPicked({ uri: asset.uri, type, name: asset.fileName ?? 'video.mp4', sizeBytes, seconds })
    } catch {
      confirmAction(t('common.error'), t('seller.productForm.video.prepareFailed'))
    } finally {
      setReading(false)
    }
  }

  function chooseSource() {
    if (Platform.OS === 'web') { void pick('library'); return }
    confirmAction(t('seller.productForm.video.add'), undefined, [
      { text: t('seller.productForm.video.record'), onPress: () => void pick('camera') },
      { text: t('seller.productForm.video.choose'), onPress: () => void pick('library') },
      { text: t('common.cancel'), style: 'cancel' },
    ])
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('seller.productForm.video.title')}</Text>
      {current ? <View style={styles.row}>
        <View style={styles.tile}>
          <Ionicons name="play-circle" size={30} color={colors.green} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{current.name}</Text>
          {current.sizeBytes ? <Text style={styles.hint}>{megabytes(current.sizeBytes)}</Text> : null}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" disabled={disabled} hitSlop={6} onPress={chooseSource}>
              <Text style={styles.link}>{t('seller.productForm.video.replace')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={disabled} hitSlop={6} onPress={onRemove}>
              <Text style={[styles.link, styles.danger]}>{t('common.remove')}</Text>
            </Pressable>
          </View>
        </View>
      </View> : <View style={styles.row}>
        <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void pick('camera')} style={({ pressed }) => [styles.slot, disabled && styles.slotDisabled, pressed && styles.slotPressed]}>
          <Ionicons name="videocam-outline" size={22} color={colors.green} />
          <Text style={styles.slotText} numberOfLines={1}>{reading ? t('common.oneMoment') : t('seller.productForm.video.record')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void pick('library')} style={({ pressed }) => [styles.slot, styles.slotPlain, disabled && styles.slotDisabled, pressed && styles.slotPressed]}>
          <Ionicons name="folder-open-outline" size={22} color={colors.green} />
          <Text style={styles.slotText} numberOfLines={1}>{t('seller.productForm.video.choose')}</Text>
        </Pressable>
      </View>}
      <Text style={styles.hint}>{t('seller.productForm.video.desc', { record: RECORD_VIDEO_SECONDS, seconds: MAX_VIDEO_SECONDS, size: MAX_VIDEO_BYTES / (1024 * 1024) })}</Text>
    </View>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  wrap: { gap: spacing.xs },
  title: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tile: { width: 84, height: 84, borderRadius: 14, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 2 },
  name: { color: colors.ink, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 16, paddingTop: 4 },
  link: { color: colors.green, fontWeight: '700', fontSize: 13 },
  danger: { color: colors.danger },
  slot: { width: 84, height: 84, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.green, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4 },
  slotPlain: { backgroundColor: colors.white },
  slotDisabled: { opacity: 0.5 },
  slotPressed: { opacity: 0.75 },
  slotText: { color: colors.green, fontWeight: '700', fontSize: 11, textAlign: 'center' },
})
