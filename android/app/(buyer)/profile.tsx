import { router } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { buyerApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { Button, Card, Loading, SectionTitle } from '../../src/components/ui'
import { colors, spacing } from '../../src/theme'

export default function ProfileScreen() {
  const user = useAuth((state) => state.user); const logout = useAuth((state) => state.logout)
  const profile = useQuery({ queryKey: ['buyer','profile'], queryFn: buyerApi.profile, enabled: user?.account_type === 'BUYER' })
  if (!user) return <View style={styles.center}><Text style={styles.title}>Your BTMI account</Text><Text style={styles.muted}>Sign in to access orders, points and personal information.</Text><Button title="Sign in" onPress={() => router.push('/auth/login')}/></View>
  if (profile.isLoading && user.account_type === 'BUYER') return <Loading label="Loading profile…"/>
  const p = profile.data
  return <ScrollView contentContainerStyle={styles.page}><SectionTitle title={`${p?.first_name || user.first_name} ${p?.last_name || user.last_name}`}/><Text style={styles.muted}>{user.email}</Text><Card><Text style={styles.eyebrow}>CONTACT</Text><Text style={styles.value}>{p?.phone || user.phone}</Text><Text style={styles.value}>{p?.backup_phone || 'No backup phone'}</Text></Card><Card><Text style={styles.eyebrow}>LOCATION</Text><Text style={styles.value}>{p?.address || 'No address provided'}</Text><Text style={styles.muted}>{[p?.commune,p?.city].filter(Boolean).join(', ') || 'No location provided'}</Text></Card><Card><Text style={styles.item}>My Orders</Text><Text style={styles.item}>My Points</Text><Text style={styles.item}>My Reviews</Text></Card>{user.account_type === 'SELLER' && <Button title="Open Seller Workspace" onPress={() => router.push('/seller')}/>}<Button variant="outline" title="Sign out" onPress={async () => { await logout(); router.replace('/(buyer)') }}/></ScrollView>
}
const styles = StyleSheet.create({ page: { padding: spacing.md, gap: spacing.md }, center: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md }, title: { fontSize: 25, fontWeight: '900', color: colors.ink, textAlign: 'center' }, muted: { color: colors.muted }, eyebrow: { color: colors.gold, fontWeight: '900', fontSize: 12 }, value: { color: colors.ink, fontWeight: '700', fontSize: 16 }, item: { color: colors.ink, fontWeight: '800', fontSize: 17, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border } })

