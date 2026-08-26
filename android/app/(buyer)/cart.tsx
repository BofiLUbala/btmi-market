import { useState } from 'react'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { buyerApi } from '../../src/api'
import { useCart } from '../../src/store/cart'
import { useAuth } from '../../src/store/auth'
import { Button, Card, ErrorState, SectionTitle } from '../../src/components/ui'
import { colors, radius, spacing } from '../../src/theme'
import type { PointRedemptionPreview } from '../../src/types'

const money = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} FC`

/** RFC4122-ish v4 id. Used only as an idempotency key for order creation. */
function idempotencyKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export default function CartScreen() {
  const { lines, shopId, shopName, setQuantity, remove } = useCart()
  const user = useAuth((state) => state.user)
  const [usePoints, setUsePoints] = useState(false)
  const [preview, setPreview] = useState<PointRedemptionPreview | null>(null)
  const [error, setError] = useState('')

  const items = lines.map((line) => ({
    product_id: line.productId,
    variant_id: line.variantId,
    quantity: line.quantity,
  }))

  // Displayed only until the server answers; the backend owns the real price.
  const estimated = lines.reduce((sum, line) => sum + line.price * line.quantity, 0)

  const previewMutation = useMutation({
    mutationFn: (next: boolean) => buyerApi.previewOrder(shopId!, items, next),
    onSuccess: (data) => {
      setPreview(data)
      setError('')
    },
    onError: () => setError('Impossible de vérifier le panier. Vérifiez la disponibilité et réessayez.'),
  })

  const createMutation = useMutation({
    mutationFn: () => buyerApi.createOrder(shopId!, items, usePoints, idempotencyKey()),
    onSuccess: (data) => {
      // The cart is now a real order; keep the lines until the order is paid
      // so a failure mid-checkout does not lose the buyer's basket.
      router.push({ pathname: '/checkout/delivery', params: { orderId: data.order.id } })
    },
    onError: () =>
      setError('La commande n’a pas pu être créée. Le stock a peut-être changé — vérifiez le panier.'),
  })

  function togglePoints() {
    const next = !usePoints
    setUsePoints(next)
    if (user) previewMutation.mutate(next)
  }

  function startCheckout() {
    if (!user) {
      router.push('/auth/login')
      return
    }
    if (!shopId) {
      Alert.alert('Panier invalide', 'Votre panier ne référence aucune boutique.')
      return
    }
    setError('')
    createMutation.mutate()
  }

  if (!lines.length) {
    return (
      <View style={styles.empty}>
        <Ionicons name="cart-outline" size={44} color={colors.muted} />
        <Text style={styles.emptyTitle}>Votre panier est vide</Text>
        <Text style={styles.muted}>Ajoutez un produit pour commencer vos achats.</Text>
        <Button title="Découvrir les produits" onPress={() => router.push('/(buyer)')} />
      </View>
    )
  }

  const busy = createMutation.isPending || previewMutation.isPending

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <SectionTitle title={`Panier · ${lines.length}`} />
      {shopName ? <Text style={styles.shopLine}>Commande chez {shopName}</Text> : null}

      {lines.map((line) => (
        <Card key={line.variantId}>
          <View style={styles.lineTop}>
            {line.image ? (
              <Image source={line.image} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty]}>
                <Ionicons name="image-outline" size={20} color={colors.muted} />
              </View>
            )}
            <View style={styles.lineInfo}>
              <Text style={styles.name} numberOfLines={2}>{line.name}</Text>
              {line.variantName ? <Text style={styles.muted}>{line.variantName}</Text> : null}
              <Text style={styles.unit}>{money(line.price)} l’unité</Text>
            </View>
          </View>

          <View style={styles.row}>
            <Button variant="outline" title="−" style={styles.step} onPress={() => setQuantity(line.variantId, line.quantity - 1)} />
            <Text style={styles.qty}>{line.quantity}</Text>
            <Button variant="outline" title="+" style={styles.step} onPress={() => setQuantity(line.variantId, line.quantity + 1)} />
            <Text style={styles.price}>{money(line.price * line.quantity)}</Text>
          </View>

          <Button variant="outline" title="Retirer" onPress={() => remove(line.variantId)} />
        </Card>
      ))}

      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.name}>Utiliser mes points BTMI</Text>
          <Button
            variant={usePoints ? 'primary' : 'outline'}
            title={usePoints ? 'Activé' : 'Activer'}
            onPress={togglePoints}
          />
        </View>
        {usePoints && preview ? (
          <Text style={styles.pointsNote}>
            {preview.points_used} points appliqués · −{money(preview.points_discount_amount)}
          </Text>
        ) : (
          <Text style={styles.muted}>Réduisez le montant à payer en cash.</Text>
        )}
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.name}>{preview ? 'Total vérifié' : 'Sous-total estimé'}</Text>
          <Text style={styles.total}>{money(preview ? preview.final_total : estimated)}</Text>
        </View>
        <Text style={styles.muted}>
          {preview
            ? 'Prix et disponibilité confirmés par la boutique.'
            : 'Le prix final et la livraison sont confirmés à l’étape suivante.'}
        </Text>
      </Card>

      {error ? <ErrorState message={error} /> : null}

      <Button
        title={user ? 'Passer la commande' : 'Se connecter pour continuer'}
        loading={busy}
        onPress={startCheckout}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  emptyTitle: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  muted: { color: colors.muted },
  shopLine: { color: colors.green, fontWeight: '800' },
  lineTop: { flexDirection: 'row', gap: spacing.sm },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.greenSoft },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  lineInfo: { flex: 1, gap: 2 },
  name: { color: colors.ink, fontWeight: '800', fontSize: 16 },
  unit: { color: colors.muted, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  step: { minWidth: 52, paddingHorizontal: spacing.sm },
  qty: { minWidth: 28, textAlign: 'center', fontWeight: '900', color: colors.ink, fontSize: 16 },
  price: { marginLeft: 'auto', color: colors.green, fontWeight: '900' },
  total: { color: colors.green, fontWeight: '900', fontSize: 19 },
  pointsNote: { color: colors.success, fontWeight: '700' },
})
