import { useMemo, useState } from 'react'
import { Linking, Modal, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { MEDIA_URL } from '../api/client'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, spacing, type Colors } from '../theme'

/** The public page of a product. The site and the API share one origin, so a
 *  phone builds it from the API's base; a browser uses the page it is on. */
export function productShareUrl(productId: string): string {
  const base = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : MEDIA_URL
  return `${base}/products/${productId}`
}

type Channel = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; color: string; href: (url: string, text: string) => string }

const CHANNELS: Channel[] = [
  { key: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366', href: (url, text) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
  { key: 'facebook', label: 'Facebook', icon: 'logo-facebook', color: '#1877F2', href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { key: 'telegram', label: 'Telegram', icon: 'paper-plane', color: '#229ED9', href: (url, text) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  { key: 'x', label: 'X', icon: 'logo-twitter', color: '#111111', href: (url, text) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
]

/** Share a link to the channels buyers actually use (WhatsApp first), plus
 *  copy-link and the device's own share sheet for everything else. */
export function ShareSheet({ visible, onClose, url, text }: { visible: boolean; onClose: () => void; url: string; text: string }) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [copied, setCopied] = useState(false)

  const open = (channel: Channel) => {
    void Linking.openURL(channel.href(url, text)).catch(() => undefined)
    onClose()
  }

  const copy = async () => {
    try {
      if (Platform.OS === 'web' && navigator.clipboard) await navigator.clipboard.writeText(url)
      else await Share.share({ message: `${text} ${url}` })
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* the person dismissed it */ }
  }

  const more = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator.share === 'function') await navigator.share({ title: text, text, url })
      else await Share.share({ message: `${text} ${url}`, url })
    } catch { /* dismissed */ }
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.title}>{t('share.title')}</Text>
          <Text style={styles.link} numberOfLines={1}>{url}</Text>
          <View style={styles.grid}>
            {CHANNELS.map((c) => (
              <Pressable key={c.key} accessibilityRole="button" accessibilityLabel={c.label} onPress={() => open(c)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
                <View style={[styles.icon, { backgroundColor: c.color }]}><Ionicons name={c.icon} size={24} color="#FFFFFF" /></View>
                <Text style={styles.itemText}>{c.label}</Text>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" onPress={() => void copy()} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
              <View style={[styles.icon, styles.iconPlain]}><Ionicons name={copied ? 'checkmark' : 'link'} size={24} color={colors.green} /></View>
              <Text style={styles.itemText}>{copied ? t('share.copied') : t('share.copy')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void more()} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
              <View style={[styles.icon, styles.iconPlain]}><Ionicons name="ellipsis-horizontal" size={24} color={colors.green} /></View>
              <Text style={styles.itemText}>{t('share.more')}</Text>
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 520, backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, gap: spacing.sm },
  title: { color: colors.ink, fontWeight: '800', fontSize: 17 },
  link: { color: colors.muted, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: spacing.sm },
  item: { width: 76, alignItems: 'center', gap: 6 },
  pressed: { opacity: 0.7 },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  iconPlain: { backgroundColor: colors.greenSoft },
  itemText: { color: colors.ink, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  cancel: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.ink, fontWeight: '700' },
})
