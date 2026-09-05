import { Stack } from 'expo-router'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { PreferenceToggleButtons } from '../../src/components/PreferenceToggles'
export default function SellerLayout() {
  const { t } = useI18n()
  const colors = useColors()
  return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.green }, headerTintColor: colors.white, headerTitleStyle: { fontWeight: '900' }, headerRight: () => <PreferenceToggleButtons /> }}><Stack.Screen name="index" options={{ title: t('seller.workspace') }}/><Stack.Screen name="onboarding" options={{ title: t('seller.onboardingTitle') }}/><Stack.Screen name="orders" options={{ title: t('seller.ordersByShop') }}/><Stack.Screen name="reviews" options={{ title: t('seller.customerReviews') }}/><Stack.Screen name="policy" options={{ title: t('seller.policy.navLabel') }}/></Stack>
}
