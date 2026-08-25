import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { post } from '../../src/api/client'
import { useCart } from '../../src/store/cart'
import { Button, Card, ErrorState, SectionTitle } from '../../src/components/ui'
import { colors, spacing } from '../../src/theme'
import { useAuth } from '../../src/store/auth'

export default function CartScreen() {
  const { lines, setQuantity, remove } = useCart()
  const user = useAuth((state) => state.user)
  const preview = useMutation({ mutationFn: () => post<unknown>('/buyer/orders/preview', { shop_id: lines[0]?.shopId, items: lines.map((line) => ({ product_id: line.productId, variant_id: line.variantId, quantity: line.quantity })), use_points: false }) })
  const subtotal = lines.reduce((sum, item) => sum + item.price * item.quantity, 0)
  if (!lines.length) return <View style={styles.empty}><Text style={styles.emptyTitle}>Votre panier est vide</Text><Text style={styles.muted}>Ajoutez un produit pour commencer vos achats.</Text></View>
  return <ScrollView contentContainerStyle={styles.page}><SectionTitle title={`Panier · ${lines.length}`}/>{lines.map((line) => <Card key={line.variantId}><Text style={styles.name}>{line.name}</Text><Text style={styles.muted}>{line.shopName}</Text><View style={styles.row}><Button variant="outline" title="−" onPress={() => setQuantity(line.variantId, line.quantity - 1)}/><Text style={styles.qty}>{line.quantity}</Text><Button variant="outline" title="+" onPress={() => setQuantity(line.variantId, line.quantity + 1)}/><Text style={styles.price}>{(line.price * line.quantity).toLocaleString()} FC</Text></View><Button variant="outline" title="Retirer" onPress={() => remove(line.variantId)}/></Card>)}<Card><View style={styles.rowBetween}><Text style={styles.name}>Sous-total estimé</Text><Text style={styles.total}>{subtotal.toLocaleString()} FC</Text></View><Text style={styles.muted}>Le prix et la disponibilité seront confirmés avant la commande.</Text></Card>{preview.isError && <ErrorState message="Impossible de valider le panier. Vérifiez la disponibilité et réessayez."/>}{preview.isSuccess && <Card><Text style={styles.valid}>Prix et disponibilité confirmés.</Text></Card>}<Button title={user ? 'Vérifier et continuer' : 'Se connecter pour continuer'} loading={preview.isPending} onPress={() => user ? preview.mutate() : router.push('/auth/login')}/></ScrollView>
}
const styles = StyleSheet.create({ page: { padding: spacing.md, gap: spacing.md }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm }, emptyTitle: { color: colors.ink, fontSize: 22, fontWeight: '900' }, muted: { color: colors.muted }, name: { color: colors.ink, fontWeight: '800', fontSize: 17 }, row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, rowBetween: { flexDirection: 'row', justifyContent: 'space-between' }, qty: { minWidth: 28, textAlign: 'center', fontWeight: '900' }, price: { marginLeft: 'auto', color: colors.green, fontWeight: '900' }, total: { color: colors.green, fontWeight: '900', fontSize: 19 }, valid: { color: colors.success, fontWeight: '800' } })
