import { useMemo, useState } from 'react'
import { router } from 'expo-router'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery } from '@tanstack/react-query'
import { sellerApi } from '../../../src/api'
import { ApiError } from '../../../src/api/client'
import { useAuth } from '../../../src/store/auth'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../../src/components/ui'
import { useI18n } from '../../../src/store/i18n'
import { useColors } from '../../../src/store/theme'
import { spacing, type Colors } from '../../../src/theme'

export default function SellerProductCreateScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const activeShop = useAuth((s) => s.activeShop)

  const categories = useQuery({ queryKey: ['seller', 'categories'], queryFn: sellerApi.categories })
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [form, setForm] = useState({ name: '', sku: '', unit: 'PCS', unit_price: '', cost_price: '', description: '', stock: '0' })
  const [selfRating, setSelfRating] = useState(0)
  const [error, setError] = useState('')

  const selectedCategory = categories.data?.find((c) => c.id === categoryId)

  const create = useMutation({
    mutationFn: async (publish: boolean) => {
      if (!activeBusiness) throw new Error(t('seller.noBusinessSelected'))
      const price = parseFloat(form.unit_price)
      if (!categoryId) throw new Error(t('seller.productForm.validation.selectCategory'))
      if (!form.name.trim()) throw new Error(t('seller.productForm.validation.nameRequired'))
      if (isNaN(price) || price <= 0) throw new Error(t('seller.productForm.validation.validPrice'))
      if (selfRating < 1 || selfRating > 5) throw new Error(t('seller.productForm.validation.selfRatingRequired'))
      const product = await sellerApi.createProduct(activeBusiness.id, {
        name: form.name.trim(), sku: form.sku.trim() || undefined, unit: form.unit.trim() || 'PCS',
        unit_price: price, cost_price: form.cost_price ? parseFloat(form.cost_price) : undefined,
        description: form.description.trim() || undefined, category_id: categoryId, subcategory_id: subcategoryId || undefined,
        publication_status: 'DRAFT', self_rating: selfRating,
      })
      // createProduct already creates a default variant server-side (same
      // name/price/unit as the product) -- creating another here would leave
      // every new product with two duplicate variants.
      const existingVariants = await sellerApi.variants(activeBusiness.id, product.id)
      const variant = existingVariants[0] ?? await sellerApi.createVariant(activeBusiness.id, product.id, { name: form.name.trim(), sale_price: price, unit: form.unit.trim() || 'PCS' })
      const stock = Math.max(0, parseInt(form.stock, 10) || 0)
      if (activeShop) await sellerApi.addStock(activeShop, { variant_id: variant.id, quantity: stock, notes: t('seller.productForm.initialStock') })
      // The product+variant+stock above are already saved at this point, so a
      // failure to flip publication_status (e.g. the category requires
      // attributes this form doesn't collect) must not read as "nothing was
      // created" -- that would strand a draft the seller can't find again.
      let publishError: string | null = null
      if (publish) {
        try { await sellerApi.updateProduct(activeBusiness.id, product.id, { status: 'ACTIVE', publication_status: 'PUBLISHED' }) }
        catch (e) { publishError = e instanceof ApiError ? e.message : t('seller.productForm.genericError') }
      }
      return { product, publishError }
    },
    onMutate: () => setError(''),
    onSuccess: ({ product, publishError }) => {
      if (publishError) Alert.alert(t('seller.productForm.savedAsDraftTitle'), t('seller.productForm.savedAsDraftBody', { reason: publishError }))
      router.replace(`/seller/products/${product.id}`)
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : t('seller.productForm.genericError')),
  })

  if (!activeBusiness) return <View style={styles.center}><Text style={styles.muted}>{t('seller.noBusinessSelected')}</Text></View>
  if (categories.isLoading) return <Loading label={t('common.loading')} />
  if (categories.isError) return <ErrorState message={t('seller.productForm.loadShopFailed')} retry={() => void categories.refetch()} />

  return <ScrollView contentContainerStyle={styles.page}>
    <SectionTitle title={t('seller.productForm.title')} />
    {error ? <Text style={styles.error}>{error}</Text> : null}

    <Card>
      <Text style={styles.cardTitle}>{t('seller.productForm.categoryLabel')}</Text>
      <View style={styles.chipRow}>
        {(categories.data ?? []).map((c) => <Pressable key={c.id} style={[styles.chip, categoryId === c.id && styles.chipActive]} onPress={() => { setCategoryId(c.id); setSubcategoryId('') }}>
          <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
        </Pressable>)}
      </View>
      {!!selectedCategory?.subcategories?.length && <>
        <Text style={styles.cardTitle}>{t('product.subcategory')}</Text>
        <View style={styles.chipRow}>
          {selectedCategory.subcategories.map((s) => <Pressable key={s.id} style={[styles.chip, subcategoryId === s.id && styles.chipActive]} onPress={() => setSubcategoryId(s.id)}>
            <Text style={[styles.chipText, subcategoryId === s.id && styles.chipTextActive]}>{s.name}</Text>
          </Pressable>)}
        </View>
      </>}
    </Card>

    <Card>
      <Text style={styles.cardTitle}>{t('seller.productForm.productInfo')}</Text>
      <Field label={t('seller.productForm.productName')} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} autoCapitalize="words" />
      <Field label={t('seller.productForm.salePrice')} value={form.unit_price} onChangeText={(v) => setForm((f) => ({ ...f, unit_price: v }))} keyboardType="numeric" />
      <Field label={t('seller.productForm.skuOptional')} value={form.sku} onChangeText={(v) => setForm((f) => ({ ...f, sku: v }))} autoCapitalize="none" />
      <Field label={t('product.unit')} value={form.unit} onChangeText={(v) => setForm((f) => ({ ...f, unit: v }))} autoCapitalize="characters" />
      <Field label={t('seller.productForm.costPriceOptional')} value={form.cost_price} onChangeText={(v) => setForm((f) => ({ ...f, cost_price: v }))} keyboardType="numeric" />
      <Field label={t('seller.productForm.descriptionOptional')} value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} multiline />
      <Text style={styles.cardTitle}>{t('seller.productForm.selfRatingLabel')}</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => <Pressable key={n} onPress={() => setSelfRating(n)}><Text style={[styles.star, n <= selfRating && styles.starActive]}>★</Text></Pressable>)}
      </View>
      <Field label={t('seller.productForm.initialStock')} value={form.stock} onChangeText={(v) => setForm((f) => ({ ...f, stock: v }))} keyboardType="numeric" />
    </Card>

    <Button variant="outline" title={t('seller.productForm.saveDraft')} loading={create.isPending} onPress={() => create.mutate(false)} />
    <Button title={t('seller.productForm.publishProduct')} loading={create.isPending} onPress={() => create.mutate(true)} />
  </ScrollView>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  muted: { color: colors.muted },
  error: { color: colors.danger, fontWeight: '700' },
  cardTitle: { fontSize: 15, fontWeight: '900', color: colors.ink },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { color: colors.ink, fontWeight: '700' },
  chipTextActive: { color: colors.white },
  stars: { flexDirection: 'row', gap: spacing.xs },
  star: { fontSize: 28, color: colors.border },
  starActive: { color: colors.star },
})
