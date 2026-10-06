import { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import { router, Tabs } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { marketplaceApi } from '../../src/api'
import { ErrorState, Loading } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { fonts, kicker, radius, shadow, spacing, type Colors } from '../../src/theme'
import { categoryLabel, subcategoryLabel } from '../../src/lib/categoryLabels'
import { categoryIcon } from '../../src/lib/categoryIcons'
import { categoryImage } from '../../src/lib/categoryVisuals'
import { normalizeSearch } from '../../src/lib/search'
import type { Category } from '../../src/types'

/** Reference tile rhythm: blue, white / white, navy, repeating. */
type Tone = 'blue' | 'white' | 'navy'
const TONES: Tone[] = ['blue', 'white', 'white', 'navy']

export default function CategoriesScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [filter, setFilter] = useState('')
  const [focused, setFocused] = useState(false)
  const query = useQuery({ queryKey: ['marketplace','categories'], queryFn: marketplaceApi.categories })

  const needle = normalizeSearch(filter.trim())
  // Client-side filter over the cached taxonomy: category or subcategory
  // names, raw and translated.
  const matches = useMemo(() => {
    const all = query.data ?? []
    if (!needle) return all
    const hit = (value: string) => normalizeSearch(value).includes(needle)
    return all.filter((category) =>
      hit(category.name) || hit(categoryLabel(t, category.slug, category.name)) ||
      (category.subcategories ?? []).some((sub) => hit(sub.name) || hit(subcategoryLabel(t, sub.slug, sub.name))))
  }, [query.data, needle, t])

  if (query.isLoading) return <Loading label={t('categories.loading')}/>
  if (query.isError) return <ErrorState message={t('categories.loadFailed')} retry={() => query.refetch()}/>
  const subsOf = (item: Category) => (item.subcategories ?? []).slice(0, 3).map((s) => subcategoryLabel(t, s.slug, s.name)).join(' · ')
  // The featured tile is the first category in the marketplace's own order;
  // while filtering every match is shown as a regular tile.
  const featured = needle ? undefined : matches[0]
  const tiles = featured ? matches.slice(1) : matches

  const header = <View style={styles.head}>
    <Text style={styles.pageTitle}>{t('tabs.categories')}</Text>
    <View style={[styles.field, focused && styles.fieldFocused]}>
      <Ionicons name="search-outline" size={17} color={focused ? colors.green : colors.muted}/>
      <TextInput
        value={filter}
        onChangeText={setFilter}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={t('browse.searchCategory')}
        placeholderTextColor={colors.faint}
        returnKeyType="search"
        style={styles.input}
      />
      {filter ? <Pressable onPress={() => setFilter('')} hitSlop={8} accessibilityLabel={t('home.clearSearch')}><Ionicons name="close-circle" size={18} color={colors.faint}/></Pressable> : null}
    </View>
    {featured ? <Pressable style={({ pressed }) => [styles.featured, pressed && styles.pressed]} accessibilityRole="button" onPress={() => router.push(`/categories/${featured.slug}`)}>
      <Image source={categoryImage(featured.slug, featured.name)} style={styles.featuredImage} contentFit="cover"/>
      <View style={styles.featuredShade} pointerEvents="none"/>
      <View style={styles.featuredCopy}>
        <Text style={styles.featuredKicker} numberOfLines={1}>{t('browse.featuredCategory')}</Text>
        <Text style={styles.featuredTitle} numberOfLines={2}>{categoryLabel(t, featured.slug, featured.name)}</Text>
        <Text style={styles.featuredSubs} numberOfLines={1}>{subsOf(featured) || t('cart.discover')}</Text>
      </View>
    </Pressable> : null}
  </View>

  return <SafeAreaView style={styles.screen} edges={['top']}>
    <Tabs.Screen options={{ headerShown: false }}/>
    <FlatList
      data={tiles}
      numColumns={2}
      contentContainerStyle={styles.list}
      columnWrapperStyle={styles.row}
      keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      ListEmptyComponent={needle ? <Text style={styles.empty}>{t('search.noResultsQuery', { query: filter.trim() })}</Text> : null}
      renderItem={({ item, index }) => {
        const tone = TONES[index % TONES.length]
        const filled = tone !== 'white'
        return <Pressable style={({ pressed }) => [styles.tile, tone === 'blue' && styles.tileBlue, tone === 'navy' && styles.tileNavy, pressed && styles.pressed]} accessibilityRole="button" onPress={() => router.push(`/categories/${item.slug}`)}>
          <View style={[styles.icon, filled && styles.iconFilled]}><Ionicons name={categoryIcon(item.slug, item.name)} size={20} color={filled ? colors.onNavy : colors.green}/></View>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: filled ? colors.onNavy : colors.ink }]} numberOfLines={2}>{categoryLabel(t, item.slug, item.name)}</Text>
            <Text style={[styles.subtitle, filled && styles.subtitleFilled]} numberOfLines={1}>{subsOf(item) || t('cart.discover')}</Text>
          </View>
        </Pressable>
      }}/>
  </SafeAreaView>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  list: { padding: spacing.md, paddingBottom: 28 },
  head: { gap: 14, marginBottom: 12 },
  pageTitle: { color: colors.ink, fontFamily: fonts.display, fontWeight: '700', fontSize: 24, letterSpacing: -0.4, marginTop: 6 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  field: { height: 44, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldFocused: { borderColor: colors.green },
  input: { flex: 1, height: '100%', paddingVertical: 0, color: colors.ink, fontSize: 14 },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: 32 },
  // Large featured tile: navy, photo on the right, eyebrow + bold label bottom-left
  featured: { height: 150, borderRadius: 18, backgroundColor: colors.navy, overflow: 'hidden', ...shadow.card },
  featuredImage: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '52%' },
  featuredShade: { position: 'absolute', top: 0, bottom: 0, left: '40%', width: '22%', backgroundColor: 'rgba(0,0,0,0.35)' },
  featuredCopy: { position: 'absolute', left: spacing.md, bottom: spacing.md, right: '45%', gap: 3 },
  featuredKicker: { ...kicker, fontSize: 9.5, color: colors.cyan },
  featuredTitle: { color: colors.onNavy, fontFamily: fonts.display, fontWeight: '700', fontSize: 19, letterSpacing: -0.3 },
  featuredSubs: { color: colors.onNavyMuted, fontSize: 11.5 },
  // 2-col tiles: icon top-left, bold label bottom-left
  row: { gap: 12, marginBottom: 12 },
  tile: { flex: 1, maxWidth: '48.5%', minHeight: 116, borderRadius: radius.md, padding: 14, justifyContent: 'space-between', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  tileBlue: { backgroundColor: colors.green, borderColor: colors.green },
  tileNavy: { backgroundColor: colors.navy, borderColor: colors.navy },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenSoft },
  iconFilled: { backgroundColor: 'rgba(255,255,255,0.16)' },
  copy: { gap: 2, marginTop: 14 },
  title: { fontWeight: '700', fontSize: 14.5, letterSpacing: -0.2 },
  subtitle: { color: colors.muted, fontSize: 11.5 },
  subtitleFilled: { color: colors.onNavyMuted },
})
