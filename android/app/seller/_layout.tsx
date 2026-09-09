import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { PreferenceToggleButtons } from '../../src/components/PreferenceToggles'

/** Mirrors web's `loadShops` effect: whenever the active business's shop
 *  list is known and the persisted `activeShop` isn't one of them (first
 *  visit, or the stored shop was deleted), fall back to the first shop.
 *  Runs at the layout level so every seller screen gets a resolved
 *  `activeShop` on direct navigation, not just after visiting the Dashboard. */
function useAutoSelectShop() {
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const activeShop = useAuth((s) => s.activeShop)
  const setActiveShop = useAuth((s) => s.setActiveShop)
  const shops = useQuery({ queryKey: ['seller', 'shops', activeBusiness?.id], queryFn: () => sellerApi.shops(activeBusiness!.id), enabled: Boolean(activeBusiness) })
  useEffect(() => {
    if (!shops.data?.length) return
    if (!activeShop || !shops.data.some((s) => s.id === activeShop)) setActiveShop(shops.data[0].id)
  }, [shops.data, activeShop, setActiveShop])
}

export default function SellerLayout() {
  const { t } = useI18n()
  const colors = useColors()
  useAutoSelectShop()
  return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.green }, headerTintColor: colors.white, headerTitleStyle: { fontWeight: '900' }, headerRight: () => <PreferenceToggleButtons /> }}>
    <Stack.Screen name="index" options={{ title: t('seller.workspace') }}/>
    <Stack.Screen name="onboarding" options={{ title: t('seller.onboardingTitle') }}/>
    <Stack.Screen name="business" options={{ title: t('seller.business') }}/>
    <Stack.Screen name="shops" options={{ title: t('seller.shops') }}/>
    <Stack.Screen name="employees" options={{ title: t('seller.employees') }}/>
    <Stack.Screen name="products/index" options={{ title: t('seller.products') }}/>
    <Stack.Screen name="products/create" options={{ title: t('seller.productForm.title') }}/>
    <Stack.Screen name="products/[id]" options={{ title: t('seller.productDetail.editTitle') }}/>
    <Stack.Screen name="stock" options={{ title: t('seller.stockPage.title') }}/>
    <Stack.Screen name="orders" options={{ title: t('seller.ordersByShop') }}/>
    <Stack.Screen name="customers/index" options={{ title: t('seller.customers') }}/>
    <Stack.Screen name="customers/[id]" options={{ title: t('seller.customers') }}/>
    <Stack.Screen name="cash" options={{ title: t('seller.cash.title') }}/>
    <Stack.Screen name="growth" options={{ title: t('seller.growth.title') }}/>
    <Stack.Screen name="reviews" options={{ title: t('seller.customerReviews') }}/>
    <Stack.Screen name="profile" options={{ title: t('seller.profile.title') }}/>
    <Stack.Screen name="policy" options={{ title: t('seller.policy.navLabel') }}/>
  </Stack>
}
