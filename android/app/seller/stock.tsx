import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { useAuth } from '../../src/store/auth'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'

export default function SellerStockScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const activeShop = useAuth((s) => s.activeShop)
  const [tab, setTab] = useState<'inventory' | 'movements'>('inventory')
  const [restock, setRestock] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  const inventory = useQuery({ queryKey: ['seller', 'inventory', activeShop], queryFn: () => sellerApi.shopInventory(activeShop!), enabled: Boolean(activeShop) && tab === 'inventory' })
  const movements = useQuery({ queryKey: ['seller', 'movements', activeShop], queryFn: () => sellerApi.stockMovements(activeShop!, { limit: 50 }), enabled: Boolean(activeShop) && tab === 'movements' })

  const addStock = useMutation({
    mutationFn: (variantId: string) => {
      const qty = parseInt(restock[variantId], 10)
      if (isNaN(qty) || qty <= 0) throw new Error(t('seller.stockPage.validQty'))
      return sellerApi.addStock(activeShop!, { variant_id: variantId, quantity: qty, notes: t('seller.stockPage.noteMobileRestock') })
    },
    onMutate: () => setError(''),
    onSuccess: (_r, variantId) => { setRestock((prev) => ({ ...prev, [variantId]: '' })); void queryClient.invalidateQueries({ queryKey: ['seller', 'inventory'] }) },
    onError: (e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : t('seller.stockPage.addFailed')),
  })

  if (!activeShop) return <View style={styles.center}><Text style={styles.title}>{t('seller.stockPage.noShopTitle')}</Text><Text style={styles.muted}>{t('seller.stockPage.noShopDesc')}</Text></View>

  return <ScrollView contentContainerStyle={styles.page}>
    <SectionTitle title={t('seller.stockPage.title')} />
    <View style={styles.tabs}>
      <Button dense variant={tab === 'inventory' ? 'primary' : 'outline'} title={t('seller.stockPage.tabInventory')} onPress={() => setTab('inventory')} />
      <Button dense variant={tab === 'movements' ? 'primary' : 'outline'} title={t('seller.stockPage.tabMovements')} onPress={() => setTab('movements')} />
    </View>
    {error ? <Text style={styles.error}>{error}</Text> : null}

    {tab === 'inventory' ? (
      inventory.isLoading ? <Loading label={t('seller.stockPage.loading')} /> : inventory.isError ? <ErrorState message={t('seller.stockPage.loadFailed')} retry={() => void inventory.refetch()} /> : !inventory.data?.length ? <Card><Text style={styles.muted}>{t('seller.stockPage.noInventoryTitle')}</Text></Card> : inventory.data.map((row) => <Card key={row.inventory.id}>
        <Text style={styles.name}>{row.product?.name || row.variant?.name || row.inventory.variant_id.slice(0, 8)}</Text>
        <Text style={styles.muted}>{row.variant?.sku || row.variant?.name || ''}{row.variant?.sale_price != null ? ` · ${Number(row.variant.sale_price).toLocaleString()} FC` : ''}</Text>
        <View style={styles.statsRow}>
          <Text style={styles.muted}>{t('seller.stockPage.onHand')}: {row.inventory.quantity}</Text>
          <Text style={styles.muted}>{t('points.reserved')}: {row.inventory.reserved_quantity}</Text>
          <Text style={[styles.available, row.inventory.available <= 5 && styles.low]}>{t('seller.productList.availableLabel')}: {row.inventory.available}</Text>
        </View>
        <View style={styles.row}>
          <View style={styles.flex1}><Field label={t('seller.stockPage.restock')} value={restock[row.inventory.variant_id] ?? ''} onChangeText={(v) => setRestock((prev) => ({ ...prev, [row.inventory.variant_id]: v }))} keyboardType="numeric" /></View>
          <Button dense loading={addStock.isPending && addStock.variables === row.inventory.variant_id} title={t('seller.stockPage.add')} onPress={() => addStock.mutate(row.inventory.variant_id)} />
        </View>
      </Card>)
    ) : (
      movements.isLoading ? <Loading label={t('seller.stockPage.loading')} /> : movements.isError ? <ErrorState message={t('seller.stockPage.loadFailed')} retry={() => void movements.refetch()} /> : !movements.data?.length ? <Card><Text style={styles.muted}>{t('seller.stockPage.noMovements')}</Text></Card> : movements.data.map((m) => <Card key={m.id}>
        <View style={styles.row}>
          <Text style={styles.badge}>{m.movement_type}</Text>
          <Text style={[styles.delta, m.quantity > 0 ? styles.positive : styles.negative]}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</Text>
        </View>
        <Text style={styles.muted}>{m.product?.name || m.variant?.name || ''} · {t('common.previous')} {m.previous_quantity} → {t('seller.stockPage.new')} {m.new_quantity}</Text>
        {m.notes ? <Text style={styles.muted}>{m.notes}</Text> : null}
        <Text style={styles.date}>{new Date(m.created_at).toLocaleString()}</Text>
      </Card>)
    )}
  </ScrollView>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  title: { fontSize: 20, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  muted: { color: colors.muted },
  error: { color: colors.danger, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: spacing.sm },
  name: { fontSize: 16, fontWeight: '900', color: colors.ink },
  statsRow: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  available: { color: colors.green, fontWeight: '800' },
  low: { color: colors.danger },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  flex1: { flex: 1 },
  badge: { color: colors.green, fontWeight: '900', fontSize: 12 },
  delta: { fontWeight: '900' },
  positive: { color: colors.success },
  negative: { color: colors.danger },
  date: { color: colors.muted, fontSize: 12 },
})
