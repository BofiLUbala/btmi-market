import { router } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { Button, Card, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'
export default function SellerHome() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const user=useAuth((s)=>s.user); const businesses=useQuery({queryKey:['seller','businesses'],queryFn:sellerApi.businesses,enabled:user?.account_type==='SELLER'})
  if(!user) return <View style={styles.center}><Text style={styles.title}>{t('seller.workspace')}</Text><Button title={t('seller.signInAsSeller')} onPress={()=>router.push('/auth/login')}/></View>
  if(user.account_type !== 'SELLER') return <View style={styles.center}><Text style={styles.title}>{t('seller.accessRequired')}</Text><Text style={styles.muted}>{t('seller.accessRequiredBody')}</Text><Button variant="outline" title={t('common.backToMarketplace')} onPress={()=>router.replace('/(buyer)')}/></View>
  if(businesses.isLoading) return <Loading label={t('seller.loadingBusinesses')}/>
  const active=businesses.data?.[0]
  if (!active) return <View style={styles.center}><Text style={styles.title}>{t('seller.createBusiness')}</Text><Text style={styles.muted}>{t('seller.onboardingBody')}</Text><Button title={t('seller.startOnboarding')} onPress={()=>router.push('/seller/onboarding')}/><Button variant="outline" title={t('common.backToMarketplace')} onPress={()=>router.replace('/(buyer)')}/></View>
  return <ScrollView contentContainerStyle={styles.page}><Text style={styles.eyebrow}>{t('seller.currentBusiness')}</Text><SectionTitle title={active?.name || t('seller.createBusiness')}/><Text style={styles.muted}>{t('seller.syncNote')}</Text><View style={styles.grid}><Card><Text style={styles.metric}>—</Text><Text style={styles.label}>{t('seller.ordersToProcess')}</Text></Card><Card><Text style={styles.metric}>—</Text><Text style={styles.label}>{t('seller.stockAlerts')}</Text></Card></View><SectionTitle title={t('seller.quickActions')}/><Card><Text style={styles.action}>{t('seller.shops')}</Text><Pressable accessibilityRole="button" onPress={()=>router.push('/seller/orders')}><Text style={styles.action}>{t('seller.orders')}  ›</Text></Pressable><Text style={styles.action}>{t('seller.products')}</Text><Text style={styles.action}>{t('seller.stock')}</Text><Pressable accessibilityRole="button" onPress={()=>router.push('/seller/policy')}><Text style={styles.action}>{t('seller.policy.navLabel')}  ›</Text></Pressable></Card><Button title={t('seller.customerReviews')} onPress={()=>router.push('/seller/reviews')}/><Button variant="outline" title={t('common.backToMarketplace')} onPress={()=>router.replace('/(buyer)')}/></ScrollView>
}
const makeStyles = (colors: Colors) => StyleSheet.create({page:{padding:spacing.md,gap:spacing.md},center:{flex:1,justifyContent:'center',padding:spacing.xl,gap:spacing.md},title:{fontSize:25,fontWeight:'900',color:colors.ink,textAlign:'center'},eyebrow:{fontSize:12,fontWeight:'900',color:colors.gold},muted:{color:colors.muted},grid:{flexDirection:'row',gap:spacing.sm},metric:{fontSize:26,fontWeight:'900',color:colors.green},label:{color:colors.muted},action:{fontSize:17,fontWeight:'800',color:colors.ink,paddingVertical:spacing.sm,borderBottomWidth:1,borderBottomColor:colors.border}})
