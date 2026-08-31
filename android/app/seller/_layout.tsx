import { Stack } from 'expo-router'
import { useI18n } from '../../src/store/i18n'
import { colors } from '../../src/theme'
export default function SellerLayout() {
  const { t } = useI18n()
  return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.green }, headerTintColor: colors.white, headerTitleStyle: { fontWeight: '900' } }}><Stack.Screen name="index" options={{ title: t('seller.workspace') }}/><Stack.Screen name="orders" options={{ title: t('seller.ordersByShop') }}/><Stack.Screen name="reviews" options={{ title: t('seller.customerReviews') }}/></Stack>
}