import { useMemo, useState } from 'react'
import { router } from 'expo-router'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../../src/api'
import { ApiError } from '../../../src/api/client'
import { useAuth } from '../../../src/store/auth'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../../src/components/ui'
import { useI18n, type TranslationKey } from '../../../src/store/i18n'
import { useColors } from '../../../src/store/theme'
import { spacing, type Colors } from '../../../src/theme'
import type { Product, PublicationStatus } from '../../../src/types'

const FILTERS: { label: TranslationKey; value: '' | PublicationStatus }[] = [
  { label: 'seller.productList.filterAll', value: '' },
  { label: 'seller.productList.filterPublished', value: 'PUBLISHED' },
  { label: 'seller.productList.filterDrafts', value: 'DRAFT' },
]

export default function SellerProductsScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const activeShop = useAuth((s) => s.activeShop)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | PublicationStatus>('')

  const products = useQuery({
    queryKey: ['seller', 'products', activeBusiness?.id, status, search],
    queryFn: () => sellerApi.products(activeBusiness!.id, { publication_status: status || undefined, search: search.trim() || undefined }),
    enabled: Boolean(activeBusiness),
  })

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['seller', 'products'] }),
      queryClient.invalidateQueries({ queryKey: ['marketplace'] }),
    ])
  }

  const togglePublish = useMutation({
    mutationFn: (product: Product) => sellerApi.updateProduct(activeBusiness!.id, product.id, { publication_status: product.publication_status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' }),
    onSuccess: invalidate,
    onError: (e) => Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('seller.productList.sendFailed')),
  })

  const archive = useMutation({
    mutationFn: (product: Product) => sellerApi.updateProduct(activeBusiness!.id, product.id, { status: 'INACTIVE', publication_status: 'ARCHIVED' }),
    onSuccess: invalidate,
    onError: (e) => Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('seller.productList.deleteFailed')),
  })

  const confirmArchive = (product: Product) => Alert.alert(
    t('seller.productList.delete'),
    t('seller.productList.archiveConfirm', { name: product.name }),
    [{ text: t('common.cancel'), style: 'cancel' }, { text: t('seller.productList.delete'), style: 'destructive', onPress: () => archive.mutate(product) }],
  )

  if (!activeBusiness) return <View style={styles.center}><Text style={styles.muted}>{t('seller.noBusinessSelected')}</Text></View>

  return <ScrollView contentContainerStyle={styles.page}>
    <SectionTitle title={t('seller.products')} action={<Button dense title={t('seller.productList.createProduct')} onPress={() => router.push('/seller/products/create')} />} />
    <Field label={t('seller.productList.searchPlaceholder')} value={search} onChangeText={setSearch} autoCapitalize="none" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {FILTERS.map((f) => <Pressable key={f.value || 'all'} accessibilityRole="button" style={[styles.filter, status === f.value && styles.filterActive]} onPress={() => setStatus(f.value)}>
        <Text style={[styles.filterText, status === f.value && styles.filterTextActive]}>{t(f.label)}</Text>
      </Pressable>)}
    </ScrollView>

    {products.isLoading ? <Loading label={t('seller.productList.loading')} /> : products.isError ? <ErrorState message={t('seller.productList.loadFailed')} retry={() => void products.refetch()} /> : !products.data?.length ? <Card><Text style={styles.muted}>{t('seller.productList.noProductsTitle')}</Text></Card> : products.data.map((product) => {
      const busy = (togglePublish.isPending && togglePublish.variables?.id === product.id) || (archive.isPending && archive.variables?.id === product.id)
      return <Card key={product.id}>
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
          <Text style={[styles.badge, product.publication_status !== 'PUBLISHED' && styles.badgeMuted]}>{t(`seller.publicationStatus.${product.publication_status}` as any)}</Text>
        </View>
        <Text style={styles.muted}>{product.category_name || t('seller.productList.generalCategory')} · {product.sku ? t('seller.productDetail.skuInfo', { sku: product.sku }) : t('seller.productList.noSku')}</Text>
        <View style={styles.row}>
          <Text style={styles.price}>{(product.unit_price ?? 0).toLocaleString()} FC</Text>
          <Text style={styles.muted}>{t('seller.productList.availableLabel')}: {product.available_quantity ?? 0}</Text>
        </View>
        <View style={styles.actions}>
          <Button dense variant="outline" title={t('seller.productList.edit')} onPress={() => router.push(`/seller/products/${product.id}`)} />
          <Button dense loading={togglePublish.isPending && togglePublish.variables?.id === product.id} title={product.publication_status === 'PUBLISHED' ? t('seller.productList.unpublish') : t('seller.productList.sendToMarket')} onPress={() => togglePublish.mutate(product)} disabled={busy} />
          <Button dense variant="outline" title={t('seller.productList.delete')} onPress={() => confirmArchive(product)} disabled={busy} />
        </View>
      </Card>
    })}
  </ScrollView>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  muted: { color: colors.muted },
  filters: { gap: spacing.sm, paddingVertical: 2 },
  filter: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  filterActive: { backgroundColor: colors.green, borderColor: colors.green },
  filterText: { color: colors.ink, fontWeight: '800' },
  filterTextActive: { color: colors.white },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { fontSize: 16, fontWeight: '900', color: colors.ink, flex: 1 },
  badge: { color: colors.green, fontWeight: '900', fontSize: 12 },
  badgeMuted: { color: colors.muted },
  price: { color: colors.green, fontWeight: '900', fontSize: 16 },
  actions: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
})
