import { Stack } from 'expo-router'
import { useI18n } from '../../src/store/i18n'

export default function AdminLayout() {
  const { t } = useI18n()
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '800' },
        contentStyle: { backgroundColor: '#090d16' },
      }}
    >
      <Stack.Screen name="index" options={{ title: t('admin.titles.direction'), headerShown: false }} />
      <Stack.Screen name="login" options={{ title: t('admin.titles.login'), headerShown: false }} />
      <Stack.Screen name="commerce/index" options={{ title: t('admin.titles.commerce') }} />
      <Stack.Screen name="commerce/products/index" options={{ title: t('admin.titles.products') }} />
      <Stack.Screen name="commerce/orders/index" options={{ title: t('admin.titles.orders') }} />
      <Stack.Screen name="commerce/inventory/index" options={{ title: t('admin.titles.inventory') }} />
      <Stack.Screen name="commerce/employees/index" options={{ title: t('admin.titles.employees') }} />
      <Stack.Screen name="commerce/marketplace/index" options={{ title: t('admin.titles.marketplace') }} />
      <Stack.Screen name="finance/index" options={{ title: t('admin.titles.finance') }} />
      <Stack.Screen name="technical/index" options={{ title: t('admin.titles.technical') }} />
      <Stack.Screen name="technical/config/index" options={{ title: t('admin.titles.config') }} />
      <Stack.Screen name="advanced/index" options={{ title: t('admin.titles.advanced') }} />
    </Stack>
  )
}
