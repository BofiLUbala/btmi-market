import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Stack } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { useColors } from '../../src/store/theme'
import { SellerDrawer } from '../../src/components/SellerDrawer'
import { SellerHeader } from '../../src/components/SellerHeader'

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
  const colors = useColors()
  useAutoSelectShop()
  const [drawerOpen, setDrawerOpen] = useState(false)
  return <View style={{ flex: 1, backgroundColor: colors.cream }}>
    {/* The seller workspace carries web's own white header (menu button +
     *  preference toggles + business/shop pills) on every screen instead of
     *  the stack's dark app bar, so the two workspaces look the same. Each
     *  screen renders its own title in its content, exactly as web's pages do. */}
    <SellerHeader onOpenMenu={() => setDrawerOpen(true)} />
    {/* No per-screen titles: the header above is shared and each screen names
     *  itself in its own content, so the stack only carries the routes. */}
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }} />
    <SellerDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
  </View>
}
