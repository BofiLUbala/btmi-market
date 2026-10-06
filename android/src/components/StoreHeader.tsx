import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { useColors } from '../store/theme'
import { useI18n } from '../store/i18n'
import { BuyerMenu } from './BuyerMenu'
import { fonts, spacing, type Colors } from '../theme'
import type { TranslationKey } from '../locales/fr'
import { BrandLogo } from './BrandLogo'
import { WideTopBar } from './WideTopBar'

/**
 * The storefront header the web shows on every buyer page at phone width:
 * logo pill, search pill, menu button. `back` adds a chevron for stack
 * screens (Android also has the system back).
 */
export function StoreHeader({ back = false }: { back?: boolean }) {
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const submit = () => {
    const q = query.trim()
    router.push({ pathname: '/(buyer)/search', params: q ? { q } : {} })
  }
  const { width } = useWindowDimensions()

  // Large screens: one bar (logo + a single card with everything else).
  if (width >= 900) {
    return <WideTopBar search={query} onSearchChange={setQuery} onSubmit={submit}
      onCamera={() => router.navigate({ pathname: '/', params: { visual: 'camera' } })}
      onGallery={() => router.navigate({ pathname: '/', params: { visual: 'gallery' } })}
      onFilters={submit} />
  }

  return (
    <View style={[s.wrap, { paddingTop: insets.top }]}>
      <View style={s.row}>
        {back && router.canGoBack() ? (
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back' as TranslationKey)} hitSlop={8} style={s.back}>
            <Ionicons name="chevron-back" size={22} color={c.ink} />
          </Pressable>
        ) : null}
        <Pressable onPress={() => router.navigate('/')} accessibilityRole="button" accessibilityLabel={t('home.logoAlt' as TranslationKey)}>
          <BrandLogo size={40} />
        </Pressable>
        <View style={s.search}>
          {/* Android wraps long placeholders instead of truncating them, so
              the hint is drawn as a one-line text, ellipsised like the web. */}
          <View style={s.inputWrap}>
            {!query ? <Text style={s.placeholder} numberOfLines={1} pointerEvents="none">{t('search.placeholder' as TranslationKey)}</Text> : null}
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={submit}
              returnKeyType="search"
              style={s.input}
            />
          </View>
          <Pressable style={s.iconBtn} onPress={() => router.navigate({ pathname: '/', params: { visual: 'camera' } })} accessibilityRole="button" accessibilityLabel={t('home.takePhotoSearch' as TranslationKey)}>
            <Ionicons name="camera-outline" size={19} color={c.muted} />
          </Pressable>
          <Pressable style={s.iconBtn} onPress={() => router.navigate({ pathname: '/', params: { visual: 'gallery' } })} accessibilityRole="button" accessibilityLabel={t('home.chooseImageSearch' as TranslationKey)}>
            <Ionicons name="image-outline" size={19} color={c.muted} />
          </Pressable>
        </View>
        <Pressable style={s.menu} onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel={t('nav.openMenu' as TranslationKey)}>
          <Ionicons name="menu" size={22} color={c.ink} />
        </Pressable>
      </View>
      <BuyerMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  )
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    wrap: { backgroundColor: c.white, borderBottomWidth: 1, borderBottomColor: c.border },
    row: { height: 64, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md },
    back: { marginLeft: -6 },
    search: { flex: 1, height: 42, borderRadius: 12, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 14, paddingRight: 4 },
    inputWrap: { flex: 1, minWidth: 60, justifyContent: 'center' },
    placeholder: { position: 'absolute', left: 0, right: 0, color: c.faint, fontSize: 14 },
    input: { color: c.ink, fontSize: 14, paddingVertical: 0, paddingHorizontal: 0 },
    iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    menu: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' },
  })
