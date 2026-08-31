import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { buyerApi } from '../../src/api'
import { Card, ErrorState, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'
export default function MyReviews(){const { t, lang } = useI18n();const colors=useColors();const styles=useMemo(()=>makeStyles(colors),[colors]);const q=useQuery({queryKey:['buyer','reviews'],queryFn:buyerApi.reviews});if(q.isLoading)return <Loading label={t('reviews.loading')}/>;if(q.isError)return <ErrorState message={t('reviews.loadFailed')}/>;return <ScrollView contentContainerStyle={styles.page}><SectionTitle title={t('profile.myReviews')}/>{!q.data?.reviews.length?<Card><Text style={styles.muted}>{t('reviews.empty')}</Text></Card>:q.data.reviews.map(r=><Card key={r.id}><Text style={styles.stars}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</Text><Text style={styles.kind}>{r.product_id?t('reviews.productKind'):t('orders.deliveryService')}</Text><Text style={styles.comment}>{r.comment||t('reviews.noComment')}</Text><Text style={styles.muted}>{r.verified_purchase?`${t('product.verifiedPurchase')} · `:''}{new Date(r.created_at).toLocaleDateString(lang==='en'?'en-US':'fr-CD')}</Text></Card>)}</ScrollView>}
const makeStyles = (colors: Colors) => StyleSheet.create({page:{padding:spacing.md,gap:spacing.md},stars:{color:colors.star,fontSize:20},kind:{fontWeight:'900',color:colors.ink},comment:{color:colors.ink,marginVertical:6},muted:{color:colors.muted}})