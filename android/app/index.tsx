import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '../src/store/auth'
import { colors } from '../src/theme'
export default function Index() {
  const { ready, user } = useAuth()
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.green} size="large"/></View>
  return <Redirect href={user?.account_type === 'SELLER' ? '/seller' : '/(buyer)'}/>
}
