import { useMemo, useState } from 'react'
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { sellerApi } from '../api'
import { useAuth } from '../store/auth'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, spacing, type Colors } from '../theme'
import { Button } from './ui'
import { PreferenceToggleButtons } from './PreferenceToggles'
import type { Business } from '../types'

/** Port of web's `.seller-top-header` at its narrow-screen rules: a white bar
 *  with the menu button on the left and the language/appearance controls on
 *  the right, then the business and shop switchers as two equal pills beneath.
 *  It replaces the stack's own dark app bar so every seller screen carries the
 *  same chrome the web workspace does. */
export function SellerHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const insets = useSafeAreaInsets()
  const sellerBusinesses = useAuth((s) => s.sellerBusinesses)
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const activeShop = useAuth((s) => s.activeShop)
  const setActiveBusiness = useAuth((s) => s.setActiveBusiness)
  const setActiveShop = useAuth((s) => s.setActiveShop)
  const [switcher, setSwitcher] = useState<'business' | 'shop' | null>(null)

  const shops = useQuery({ queryKey: ['seller', 'shops', activeBusiness?.id], queryFn: () => sellerApi.shops(activeBusiness!.id), enabled: Boolean(activeBusiness) })
  const shopList = shops.data ?? []
  const currentShop = shopList.find((s) => s.id === activeShop)

  return <>
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('nav.openMenu')} onPress={onOpenMenu} style={styles.toggle}>
          <Ionicons name="menu" size={22} color={colors.ink} />
        </Pressable>
        <PreferenceToggleButtons round />
      </View>

      <View style={styles.contextRow}>
        <Pressable accessibilityRole="button" style={[styles.pill, !activeBusiness && styles.pillEmpty]} onPress={() => setSwitcher('business')}>
          <Ionicons name="business-outline" size={16} color={colors.green} />
          <Text numberOfLines={1} style={[styles.pillLabel, !activeBusiness && styles.pillLabelEmpty]}>{activeBusiness ? activeBusiness.name : t('seller.noBusinessSelected')}</Text>
          {sellerBusinesses.length > 1 && <Ionicons name="chevron-down" size={14} color={colors.muted} />}
        </Pressable>
        {activeBusiness && shopList.length > 0 && (
          <Pressable accessibilityRole="button" style={styles.pill} onPress={() => setSwitcher('shop')}>
            <Ionicons name="storefront-outline" size={16} color={colors.green} />
            <Text numberOfLines={1} style={styles.pillLabel}>{currentShop ? currentShop.name : t('seller.allShops')}</Text>
            {shopList.length > 1 && <Ionicons name="chevron-down" size={14} color={colors.muted} />}
          </Pressable>
        )}
      </View>
    </View>

    {switcher && <Pressable style={styles.backdrop} onPress={() => setSwitcher(null)}>
      <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
        {switcher === 'business' ? <>
          <Text style={styles.sheetTitle}>{t('seller.currentBusiness')}</Text>
          <ScrollView>
            {sellerBusinesses.map((business: Business) => (
              <Pressable key={business.id} accessibilityRole="button" style={styles.sheetRow} onPress={() => { setActiveBusiness(business); setSwitcher(null) }}>
                <Text style={[styles.sheetRowText, business.id === activeBusiness?.id && styles.sheetRowActive]}>{business.name}</Text>
                {business.id === activeBusiness?.id && <Ionicons name="checkmark" size={18} color={colors.green} />}
              </Pressable>
            ))}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={() => { setSwitcher(null); router.push('/seller/onboarding') }}><Text style={styles.sheetAction}>{t('seller.addNewBusiness')}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setSwitcher(null); router.push('/seller/business') }}><Text style={styles.sheetAction}>{t('seller.manageBusiness')}</Text></Pressable>
        </> : <>
          <Text style={styles.sheetTitle}>{t('seller.selectActiveShop')}</Text>
          <ScrollView>
            {shopList.map((shop) => (
              <Pressable key={shop.id} accessibilityRole="button" style={styles.sheetRow} onPress={() => { setActiveShop(shop.id); setSwitcher(null) }}>
                <Text style={[styles.sheetRowText, shop.id === activeShop && styles.sheetRowActive]}>{shop.name}</Text>
                {shop.id === activeShop && <Ionicons name="checkmark" size={18} color={colors.green} />}
              </Pressable>
            ))}
          </ScrollView>
        </>}
        <Button variant="outline" title={t('common.cancel')} onPress={() => setSwitcher(null)} />
      </Pressable>
    </Pressable>}
  </>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  // web: background #fff, border-bottom 1px, padding 56px 12px 10px
  header: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // web: .seller-mobile-toggle — 38px square, radius-sm, transparent, 1px border
  toggle: { width: 38, height: 38, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  // web: .seller-header-left — grid of 2 equal columns, gap 8
  contextRow: { flexDirection: 'row', gap: 8 },
  // web: .seller-context-btn — h40, padding 7/9, surface-2, 1px border, radius 10
  pill: { flex: 1, minWidth: 0, minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingHorizontal: 9, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm },
  pillEmpty: { borderStyle: 'dashed' },
  pillLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink },
  pillLabelEmpty: { color: colors.muted },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md, gap: spacing.xs, maxHeight: '80%' },
  sheetTitle: { fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0.6 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetRowText: { fontSize: 16, fontWeight: '700', color: colors.ink },
  sheetRowActive: { color: colors.green },
  sheetAction: { color: colors.gold, fontWeight: '800', paddingVertical: spacing.sm },
})
