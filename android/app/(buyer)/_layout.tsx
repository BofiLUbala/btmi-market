import { Tabs } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../src/theme'
export default function BuyerTabs() {
  const insets = useSafeAreaInsets()
  return <Tabs safeAreaInsets={{ bottom: insets.bottom }} screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.ink, headerShadowVisible: false, headerTitleStyle: { fontWeight: '800' }, tabBarActiveTintColor: colors.green, tabBarInactiveTintColor: colors.mutedLight, tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 }, tabBarHideOnKeyboard: true, tabBarStyle: { height: 58 + insets.bottom, paddingTop: 7, paddingBottom: Math.max(insets.bottom, 8), borderTopColor: colors.surfaceAlt, backgroundColor: colors.white } }}>
  <Tabs.Screen name="index" options={{ title: 'Accueil', headerShown: false, tabBarIcon: ({color,focused}) => <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color}/> }}/>
  <Tabs.Screen name="categories" options={{ title: 'Catégories', headerTitle: 'Catégories', tabBarIcon: ({color,focused}) => <Ionicons name={focused ? 'grid' : 'grid-outline'} size={21} color={color}/> }}/>
  <Tabs.Screen name="cart" options={{ title: 'Panier', headerTitle: 'Mon panier', tabBarIcon: ({color,focused}) => <Ionicons name={focused ? 'bag-handle' : 'bag-handle-outline'} size={22} color={color}/> }}/>
  <Tabs.Screen name="favorites" options={{ title: 'Favoris', headerTitle: 'Mes favoris', tabBarIcon: ({color,focused}) => <Ionicons name={focused ? 'heart' : 'heart-outline'} size={22} color={color}/> }}/>
  <Tabs.Screen name="profile" options={{ title: 'Profil', headerTitle: 'Mon profil', tabBarIcon: ({color,focused}) => <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color}/> }}/>
</Tabs> }
