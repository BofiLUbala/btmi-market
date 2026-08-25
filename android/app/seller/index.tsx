import { router } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { Button, Card, Loading, SectionTitle } from '../../src/components/ui'
import { colors, spacing } from '../../src/theme'
export default function SellerHome() {
  const user=useAuth((s)=>s.user); const businesses=useQuery({queryKey:['seller','businesses'],queryFn:sellerApi.businesses,enabled:user?.account_type==='SELLER'})
  if(!user) return <View style={styles.center}><Text style={styles.title}>Seller Workspace</Text><Button title="Sign in as Seller" onPress={()=>router.push('/auth/login')}/></View>
  if(user.account_type !== 'SELLER') return <View style={styles.center}><Text style={styles.title}>Seller access required</Text><Text style={styles.muted}>This Buyer account does not have access to Seller operations.</Text><Button variant="outline" title="Back to Marketplace" onPress={()=>router.replace('/(buyer)')}/></View>
  if(businesses.isLoading) return <Loading label="Loading businesses…"/>
  const active=businesses.data?.[0]
  return <ScrollView contentContainerStyle={styles.page}><Text style={styles.eyebrow}>CURRENT BUSINESS</Text><SectionTitle title={active?.name || 'Create your Business'}/><Text style={styles.muted}>Mobile operations use the same live backend state as the Web workspace.</Text><View style={styles.grid}><Card><Text style={styles.metric}>—</Text><Text style={styles.label}>Orders to process</Text></Card><Card><Text style={styles.metric}>—</Text><Text style={styles.label}>Stock alerts</Text></Card></View><SectionTitle title="Quick actions"/><Card><Text style={styles.action}>Shops</Text><Text style={styles.action}>Orders</Text><Text style={styles.action}>Products</Text><Text style={styles.action}>Stock</Text></Card><Button variant="outline" title="Back to Marketplace" onPress={()=>router.replace('/(buyer)')}/></ScrollView>
}
const styles=StyleSheet.create({page:{padding:spacing.md,gap:spacing.md},center:{flex:1,justifyContent:'center',padding:spacing.xl,gap:spacing.md},title:{fontSize:25,fontWeight:'900',color:colors.ink,textAlign:'center'},eyebrow:{fontSize:12,fontWeight:'900',color:colors.gold},muted:{color:colors.muted},grid:{flexDirection:'row',gap:spacing.sm},metric:{fontSize:26,fontWeight:'900',color:colors.green},label:{color:colors.muted},action:{fontSize:17,fontWeight:'800',color:colors.ink,paddingVertical:spacing.sm,borderBottomWidth:1,borderBottomColor:colors.border}})
