import { useMemo } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { Button } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { useFavorites } from '../../src/store/favorites'
import { categoryImage } from '../../src/lib/categoryVisuals'
import { categoryLabel } from '../../src/lib/categoryLabels'
import { formatMoney } from '../../src/lib/money'
import { kicker, spacing, type Colors, fonts } from '../../src/theme'

export default function FavoritesScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const items = useFavorites((state) => state.items)
  const remove = useFavorites((state) => state.remove)

  if (items.length === 0) {
    return <View style={styles.page}>
      <View style={styles.icon}><Ionicons name="heart-outline" size={34} color={colors.ink}/></View>
      <Text style={styles.title}>{t('favorites.title')}</Text>
      <Text style={styles.text}>{t('favorites.body')}</Text>
      <Button variant="outline" title={t('cart.discover')} onPress={() => router.push('/(buyer)')}/>
    </View>
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.productId}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <Pressable style={styles.card} accessibilityRole="button" onPress={() => router.push(`/products/${item.productId}`)}>
          <View style={styles.media}>
            <Image source={item.image ?? categoryImage(item.categorySlug, item.categoryName)} style={styles.image} contentFit="cover" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('product.removeFromFavorites')}
              hitSlop={8}
              style={styles.fav}
              onPress={() => remove(item.productId)}
            >
              <Ionicons name="heart" size={19} color="#B3261E" />
            </Pressable>
          </View>
          {item.categoryName ? <Text numberOfLines={1} style={styles.kicker}>{categoryLabel(t, item.categorySlug, item.categoryName)}</Text> : null}
          <Text numberOfLines={2} style={styles.name}>{item.name}</Text>
          <Text numberOfLines={1} style={styles.shop}>{item.shopName}</Text>
          <Text style={styles.price}>{formatMoney(item.price, item.currency)}</Text>
        </Pressable>
      )}
    />
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  icon: { width: 74, height: 74, borderRadius: 37, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 23, fontFamily: fonts.display, fontWeight: '500', color: colors.ink, textAlign: 'center' },
  text: { color: colors.muted, textAlign: 'center', lineHeight: 21, maxWidth: 300 },
  list: { padding: spacing.md, gap: spacing.lg },
  row: { gap: 12 },
  card: { flex: 1, maxWidth: '48.5%', gap: 4 },
  media: { aspectRatio: 4 / 5, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surfaceAlt, marginBottom: 6 },
  image: { width: '100%', height: '100%' },
  fav: { position: 'absolute', top: 8, right: 8, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  kicker: { ...kicker, fontSize: 10, color: colors.muted },
  name: { color: colors.ink, fontWeight: '500', fontSize: 14, lineHeight: 19 },
  shop: { color: colors.muted, fontSize: 12 },
  price: { color: colors.ink, fontFamily: fonts.display, fontWeight: '600', fontSize: 17 },
})
