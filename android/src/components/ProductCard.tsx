import { Image } from 'expo-image'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { PublicProduct } from '../types'
import { colors, radius, spacing } from '../theme'
import { resolveMediaUrl } from '../api/client'

const money = (value = 0, currency = 'FC') => `${value.toLocaleString('fr-FR')} ${currency === 'CDF' ? 'FC' : currency}`
export function ProductCard({ product, onPress }: { product: PublicProduct; onPress: () => void }) {
  const firstImage = product.images?.[0]
  const rawImage = product.primary_image_url || product.image_url || (typeof firstImage === 'string' ? firstImage : firstImage?.url || firstImage?.image_url)
  const image = resolveMediaUrl(rawImage)
  const price = product.sale_price || product.price || product.base_price || 0
  return <Pressable onPress={onPress} style={({pressed}) => [styles.card, pressed && styles.pressed]} accessibilityRole="button">
    <View style={styles.media}>{image ? <Image source={image} style={styles.image} contentFit="cover" transition={180}/> : <Text style={styles.placeholder}>BTMI</Text>}</View>
    <View style={styles.body}><Text numberOfLines={2} style={styles.name}>{product.name}</Text><Text numberOfLines={1} style={styles.shop}>{product.shop_name || 'BTMI seller'}</Text><Text style={styles.price}>{money(price, product.currency)}</Text></View>
  </Pressable>
}
const styles = StyleSheet.create({ card: { flex: 1, maxWidth: '48.5%', borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: '#ECE9E0', overflow: 'hidden', shadowColor: '#10271F', shadowOpacity: .07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, pressed: { opacity: .88, transform: [{ scale: .985 }] }, media: { height: 150, backgroundColor: '#F0F4F1', alignItems: 'center', justifyContent: 'center' }, image: { width: '100%', height: '100%' }, placeholder: { color: colors.green, fontWeight: '900', fontSize: 19 }, body: { padding: 12, gap: 5 }, name: { color: colors.ink, fontWeight: '800', minHeight: 40, lineHeight: 19 }, shop: { color: colors.muted, fontSize: 12 }, price: { color: colors.green, fontWeight: '900', fontSize: 16, marginTop: 2 } })
