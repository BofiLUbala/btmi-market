import { Stack } from 'expo-router'
import { colors } from '../../src/theme'
export default function SellerLayout() { return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.green }, headerTintColor: colors.white, headerTitleStyle: { fontWeight: '900' } }}><Stack.Screen name="index" options={{ title: 'Seller Workspace' }}/><Stack.Screen name="reviews" options={{ title: 'Customer reviews' }}/></Stack> }
