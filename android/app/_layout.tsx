import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import NetInfo from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { useAuth } from '../src/store/auth'
import { colors } from '../src/theme'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 2, refetchOnReconnect: true }, mutations: { retry: 0 } } })

export default function RootLayout() {
  const bootstrap = useAuth((state) => state.bootstrap)
  useEffect(() => { bootstrap(); return NetInfo.addEventListener((state) => onlineManager.setOnline(Boolean(state.isConnected))) }, [bootstrap])
  return <QueryClientProvider client={queryClient}><StatusBar style="light"/><Stack screenOptions={{ headerStyle: { backgroundColor: colors.green }, headerTintColor: colors.white, headerTitleStyle: { fontWeight: '800' }, contentStyle: { backgroundColor: colors.cream } }}><Stack.Screen name="index" options={{ headerShown: false }}/><Stack.Screen name="(buyer)" options={{ headerShown: false }}/><Stack.Screen name="auth/login" options={{ title: 'Sign in' }}/><Stack.Screen name="products/[id]" options={{ title: 'Product' }}/><Stack.Screen name="seller" options={{ headerShown: false }}/></Stack></QueryClientProvider>
}

