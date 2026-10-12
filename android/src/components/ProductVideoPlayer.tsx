import { createElement, useMemo } from 'react'
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { resolveMediaUrl } from '../api/client'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, spacing, type Colors } from '../theme'

/** The seller's explainer video on the public product page. On the web it plays
 *  inline; on a phone it opens in the device's own video player, which needs no
 *  native video module and so works in the installed app without a new build. */
export function ProductVideoPlayer({ url }: { url?: string }) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const source = resolveMediaUrl(url)
  if (!source) return null

  return (
    <View style={styles.wrap} accessibilityLabel={t('product.video.title')}>
      <Text style={styles.title}>{t('product.video.title')}</Text>
      {Platform.OS === 'web'
        ? createElement('video', { src: source, controls: true, playsInline: true, preload: 'metadata', style: { width: '100%', maxHeight: 420, borderRadius: radius.md, backgroundColor: '#000' } })
        : <Pressable accessibilityRole="button" onPress={() => void Linking.openURL(source)} style={({ pressed }) => [styles.watch, pressed && { opacity: 0.8 }]}>
            <Ionicons name="play-circle" size={34} color={colors.onGreen} />
            <Text style={styles.watchText}>{t('product.video.watch')}</Text>
          </Pressable>}
    </View>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { color: colors.ink, fontWeight: '800', fontSize: 16 },
  watch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 56, borderRadius: radius.md, backgroundColor: colors.green },
  watchText: { color: colors.onGreen, fontWeight: '800', fontSize: 15 },
})
