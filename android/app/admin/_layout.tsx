import { Stack } from 'expo-router'

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '800' },
        contentStyle: { backgroundColor: '#090d16' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Direction Control Center', headerShown: false }} />
      <Stack.Screen name="login" options={{ title: 'Admin Authentication', headerShown: false }} />
      <Stack.Screen name="commerce/index" options={{ title: 'Commerce & Operations' }} />
      <Stack.Screen name="commerce/products/index" options={{ title: 'Product Catalog' }} />
      <Stack.Screen name="commerce/orders/index" options={{ title: 'Orders' }} />
      <Stack.Screen name="commerce/inventory/index" options={{ title: 'Inventory Control' }} />
      <Stack.Screen name="commerce/employees/index" options={{ title: 'Employees' }} />
      <Stack.Screen name="commerce/marketplace/index" options={{ title: 'Marketplace Visibility' }} />
      <Stack.Screen name="finance/index" options={{ title: 'Finance & Trust' }} />
      <Stack.Screen name="technical/index" options={{ title: 'Technical & Security' }} />
      <Stack.Screen name="technical/config/index" options={{ title: 'Feature Flags & Config' }} />
      <Stack.Screen name="advanced/index" options={{ title: 'Advanced Management' }} />
    </Stack>
  )
}
