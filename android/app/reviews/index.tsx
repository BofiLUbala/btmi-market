import { ScrollView, StyleSheet, Text } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { buyerApi } from '../../src/api'
import { Card, ErrorState, Loading, SectionTitle } from '../../src/components/ui'
import { colors, spacing } from '../../src/theme'
export default function MyReviews(){const q=useQuery({queryKey:['buyer','reviews'],queryFn:buyerApi.reviews});if(q.isLoading)return <Loading label="Chargement de vos avis…"/>;if(q.isError)return <ErrorState message="Impossible de charger vos avis."/>;return <ScrollView contentContainerStyle={styles.page}><SectionTitle title="Mes avis"/>{!q.data?.reviews.length?<Card><Text style={styles.muted}>Aucun avis publié.</Text></Card>:q.data.reviews.map(r=><Card key={r.id}><Text style={styles.stars}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</Text><Text style={styles.kind}>{r.product_id?'Avis produit':'Livraison et service'}</Text><Text style={styles.comment}>{r.comment||'Sans commentaire'}</Text><Text style={styles.muted}>{r.verified_purchase?'Achat vérifié · ':''}{new Date(r.created_at).toLocaleDateString('fr-CD')}</Text></Card>)}</ScrollView>}
const styles=StyleSheet.create({page:{padding:spacing.md,gap:spacing.md},stars:{color:colors.gold,fontSize:20},kind:{fontWeight:'900',color:colors.ink},comment:{color:colors.ink,marginVertical:6},muted:{color:colors.muted}})
