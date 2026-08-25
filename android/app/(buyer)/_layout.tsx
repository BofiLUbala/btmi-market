import { Tabs } from 'expo-router'
import { Text, type ColorValue } from 'react-native'
import { colors } from '../../src/theme'
const Icon = ({ value, color }: { value: string; color: ColorValue }) => <Text style={{ color, fontSize: 20 }}>{value}</Text>
export default function BuyerTabs() { return <Tabs screenOptions={{ headerStyle: { backgroundColor: colors.green }, headerTintColor: colors.white, headerTitleStyle: { fontWeight: '900' }, tabBarActiveTintColor: colors.green, tabBarInactiveTintColor: colors.muted, tabBarStyle: { height: 68, paddingTop: 7, paddingBottom: 9 } }}>
  <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({color}) => <Icon value="⌂" color={color}/> }}/>
  <Tabs.Screen name="categories" options={{ title: 'Categories', tabBarIcon: ({color}) => <Icon value="▦" color={color}/> }}/>
  <Tabs.Screen name="cart" options={{ title: 'Cart', tabBarIcon: ({color}) => <Icon value="🛒" color={color}/> }}/>
  <Tabs.Screen name="favorites" options={{ title: 'Favorites', tabBarIcon: ({color}) => <Icon value="♡" color={color}/> }}/>
  <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({color}) => <Icon value="●" color={color}/> }}/>
</Tabs> }
