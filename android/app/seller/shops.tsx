import { useMemo, useState } from 'react'
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { useAuth } from '../../src/store/auth'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n, type TranslationKey } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors } from '../../src/theme'
import type { CreateShopRequest, Shop, UpdateShopRequest } from '../../src/types'

const emptyForm: CreateShopRequest = {
  name: '', type: 'PHYSICAL', city: '', address: '', phone: '',
  supports_shop_delivery: false, shop_delivery_fee: 0,
  supports_partner_delivery: false, partner_delivery_fee: 0, partner_delivery_provider: '',
  delivery_city: '', delivery_address: '',
}

interface ShopStats { productCount: number; unitCount: number }

export default function SellerShopsScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const activeShop = useAuth((s) => s.activeShop)
  const setActiveShop = useAuth((s) => s.setActiveShop)

  const shops = useQuery({ queryKey: ['seller', 'shops', activeBusiness?.id], queryFn: () => sellerApi.shops(activeBusiness!.id), enabled: Boolean(activeBusiness) })

  // Per-shop product/unit counts, same figures web derives from each shop's
  // live stock rows so the card isn't just a name and an address.
  const inventories = useQueries({
    queries: (shops.data ?? []).map((shop) => ({
      queryKey: ['seller', 'inventory', shop.id],
      queryFn: () => sellerApi.shopInventory(shop.id),
    })),
  })
  const stats = useMemo(() => {
    const out: Record<string, ShopStats> = {}
    ;(shops.data ?? []).forEach((shop, i) => {
      const rows = inventories[i]?.data ?? []
      const products = new Set<string>()
      let units = 0
      for (const { inventory } of rows) {
        if (!inventory?.product_id) continue
        products.add(inventory.product_id)
        units += Number(inventory.quantity ?? 0)
      }
      out[shop.id] = { productCount: products.size, unitCount: units }
    })
    return out
  }, [shops.data, inventories])

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<Shop | null>(null)
  const [editForm, setEditForm] = useState<UpdateShopRequest>({})
  const [pendingDelete, setPendingDelete] = useState<Shop | null>(null)
  const [deleteOutcome, setDeleteOutcome] = useState<'archived' | 'deleted' | ''>('')
  const [error, setError] = useState('')

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['seller', 'shops'] })
    void queryClient.invalidateQueries({ queryKey: ['seller', 'inventory'] })
  }

  const create = useMutation({
    mutationFn: () => sellerApi.createShop(activeBusiness!.id, form),
    onMutate: () => setError(''),
    onSuccess: () => { setShowCreate(false); setForm(emptyForm); invalidate() },
    onError: (e) => setError(e instanceof ApiError ? e.message : t('seller.shops.createFailed')),
  })

  const update = useMutation({
    mutationFn: () => sellerApi.updateShop(editing!.id, { ...editForm, name: editForm.name?.trim() }),
    onMutate: () => setError(''),
    onSuccess: () => { setEditing(null); invalidate() },
    onError: (e) => setError(e instanceof ApiError ? e.message : t('seller.shops.updateFailed')),
  })

  // Archives when the shop still holds commercial history, deletes when empty —
  // the backend decides which, so the outcome message comes from its response.
  const remove = useMutation({
    mutationFn: (shop: Shop) => sellerApi.deleteShop(shop.id),
    onMutate: () => setError(''),
    onSuccess: (res) => { setPendingDelete(null); setDeleteOutcome(res?.action === 'archived' ? 'archived' : 'deleted'); invalidate() },
    onError: (e) => setError(e instanceof ApiError ? e.message : t('seller.shops.deleteFailed')),
  })

  const restore = useMutation({
    mutationFn: (shop: Shop) => sellerApi.updateShop(shop.id, { status: 'ACTIVE' }),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof ApiError ? e.message : t('seller.shops.restoreFailed')),
  })

  const openSettings = (shop: Shop) => {
    setEditing(shop)
    setEditForm({
      name: shop.name,
      supports_shop_delivery: shop.supports_shop_delivery,
      shop_delivery_fee: shop.shop_delivery_fee,
      supports_partner_delivery: shop.supports_partner_delivery,
      partner_delivery_fee: shop.partner_delivery_fee,
      partner_delivery_provider: shop.partner_delivery_provider ?? '',
      delivery_city: shop.delivery_city ?? '',
      delivery_address: shop.delivery_address ?? '',
    })
  }

  if (!activeBusiness) return <View style={styles.center}><Text style={styles.muted}>{t('seller.noBusinessSelected')}</Text></View>
  if (shops.isLoading) return <Loading label={t('seller.shops.loading')} />
  if (shops.isError) return <ErrorState message={t('seller.shops.loadFailed')} retry={() => void shops.refetch()} />

  return <ScrollView contentContainerStyle={styles.page}>
    <SectionTitle title={t('seller.shops')} action={<Button dense title={showCreate ? t('common.cancel') : t('seller.shops.createShop')} onPress={() => setShowCreate((v) => !v)} />} />
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {deleteOutcome ? <Card><Text style={styles.success}>{t(deleteOutcome === 'archived' ? 'seller.shops.archivedOutcome' : 'seller.shops.deletedOutcome')}</Text></Card> : null}

    {showCreate && <Card>
      <Text style={styles.cardTitle}>{t('seller.shops.createTitle')}</Text>
      <Field label={t('seller.shops.name')} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} autoCapitalize="words" />
      <View style={styles.typeRow}>
        <Pressable accessibilityRole="button" style={[styles.typeOption, form.type === 'PHYSICAL' && styles.typeOptionActive]} onPress={() => setForm((f) => ({ ...f, type: 'PHYSICAL' }))}><Text style={[styles.typeLabel, form.type === 'PHYSICAL' && styles.typeLabelActive]}>{t('seller.shopTypePhysical')}</Text></Pressable>
        <Pressable accessibilityRole="button" style={[styles.typeOption, form.type === 'ONLINE' && styles.typeOptionActive]} onPress={() => setForm((f) => ({ ...f, type: 'ONLINE' }))}><Text style={[styles.typeLabel, form.type === 'ONLINE' && styles.typeLabelActive]}>{t('seller.shopTypeOnline')}</Text></Pressable>
      </View>
      <Field label={t('seller.city')} value={form.city} onChangeText={(v) => setForm((f) => ({ ...f, city: v }))} autoCapitalize="words" />
      <Field label={t('seller.address')} value={form.address} onChangeText={(v) => setForm((f) => ({ ...f, address: v }))} autoCapitalize="words" />
      <Field label={t('auth.phone')} value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" />

      <DeliverySection
        value={form}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        showDesc
        colors={colors}
        styles={styles}
        t={t}
      />
      <Button title={t('seller.shops.createSubmit')} loading={create.isPending} onPress={() => create.mutate()} />
    </Card>}

    {editing && <Card>
      <Text style={styles.cardTitle}>{t('seller.shops.settingsTitle', { shop: editing.name })}</Text>
      <Field label={t('seller.shops.name')} value={editForm.name ?? ''} onChangeText={(v) => setEditForm((f) => ({ ...f, name: v }))} autoCapitalize="words" />
      <DeliverySection
        value={editForm}
        onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
        colors={colors}
        styles={styles}
        t={t}
      />
      <Button title={t('common.save')} loading={update.isPending} disabled={!editForm.name?.trim()} onPress={() => update.mutate()} />
      <Button variant="outline" title={t('common.cancel')} onPress={() => setEditing(null)} />
    </Card>}

    {pendingDelete && <View style={styles.dangerCard}>
      <Text style={styles.cardTitle}>{t('seller.shops.deleteTitle', { shop: pendingDelete.name })}</Text>
      <Text style={styles.small}>{t('seller.shops.deleteBody', { products: stats[pendingDelete.id]?.productCount ?? 0, units: stats[pendingDelete.id]?.unitCount ?? 0 })}</Text>
      <Text style={styles.small}>{t('seller.shops.deleteConsequence')}</Text>
      <Button title={t('seller.shops.deleteArchiveShop')} loading={remove.isPending} onPress={() => remove.mutate(pendingDelete)} />
      <Button variant="outline" title={t('common.cancel')} onPress={() => setPendingDelete(null)} />
    </View>}

    {!shops.data?.length ? <Card><Text style={styles.muted}>{t('seller.shops.noShopsYet')}</Text></Card> : shops.data.map((shop) => {
      const archived = shop.status !== 'ACTIVE'
      const s = stats[shop.id] ?? { productCount: 0, unitCount: 0 }
      return <Card key={shop.id}>
        <View style={styles.row}>
          <Text style={styles.shopName}>{shop.name}</Text>
          <Text style={[styles.badge, archived ? styles.badgeMuted : styles.badgeActive]}>{t(`seller.shopStatus.${shop.status ?? 'ACTIVE'}` as TranslationKey)}</Text>
        </View>
        <Text style={styles.muted}>{[shop.city, shop.address].filter(Boolean).join(' — ') || shop.type}</Text>
        <Text style={styles.small}>{t('seller.shops.statsProducts', { count: s.productCount })} · {t('seller.shops.statsUnits', { count: s.unitCount })}</Text>
        {shop.id === activeShop ? <Text style={styles.activeHint}>{t('seller.shops.currentShop')}</Text> : !archived && <Button variant="outline" dense title={t('seller.shops.setActive')} onPress={() => setActiveShop(shop.id)} />}
        {!archived && <Button dense title={t('seller.shops.openShop')} onPress={() => { setActiveShop(shop.id); router.push('/seller/products') }} />}
        <View style={styles.row}>
          {!archived ? <>
            <Pressable accessibilityRole="button" onPress={() => openSettings(shop)}><Text style={styles.link}>{t('seller.shops.settings')}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setDeleteOutcome(''); setPendingDelete(shop) }}><Text style={styles.linkDanger}>{t('seller.shops.deleteArchive')}</Text></Pressable>
          </> : <Pressable accessibilityRole="button" onPress={() => restore.mutate(shop)}><Text style={styles.link}>{t('seller.shops.restoreShop')}</Text></Pressable>}
        </View>
      </Card>
    })}
  </ScrollView>
}

type S = ReturnType<typeof makeStyles>
type DeliveryFields = Pick<UpdateShopRequest, 'supports_shop_delivery' | 'shop_delivery_fee' | 'supports_partner_delivery' | 'partner_delivery_fee' | 'partner_delivery_provider' | 'delivery_city' | 'delivery_address'>

/** Shared by the create and settings forms, mirroring web where both render
 *  the same delivery block. Without it a shop created on mobile would carry no
 *  delivery configuration at all, and buyers would see no delivery option. */
function DeliverySection({ value, onChange, showDesc, colors, styles, t }: { value: DeliveryFields; onChange: (patch: DeliveryFields) => void; showDesc?: boolean; colors: Colors; styles: S; t: (key: TranslationKey, vars?: Record<string, string | number>) => string }) {
  const anyDelivery = value.supports_shop_delivery || value.supports_partner_delivery
  return <>
    <Text style={styles.subhead}>{t('seller.shops.deliveryOptions')}</Text>
    {showDesc && <Text style={styles.small}>{t('seller.shops.deliveryOptionsDesc')}</Text>}

    <CheckRow label={t('seller.shops.shopDeliversItself')} checked={!!value.supports_shop_delivery} onToggle={() => onChange({ supports_shop_delivery: !value.supports_shop_delivery })} styles={styles} />
    {value.supports_shop_delivery && <Field label={t('seller.shops.selfDeliveryFee')} value={String(value.shop_delivery_fee ?? 0)} onChangeText={(v) => onChange({ shop_delivery_fee: Number(v.replace(/[^0-9]/g, '')) || 0 })} keyboardType="numeric" />}

    <CheckRow label={t('seller.shops.usesPartner')} checked={!!value.supports_partner_delivery} onToggle={() => onChange({ supports_partner_delivery: !value.supports_partner_delivery })} styles={styles} />
    {value.supports_partner_delivery && <>
      <Field label={t('seller.shops.partnerFee')} value={String(value.partner_delivery_fee ?? 0)} onChangeText={(v) => onChange({ partner_delivery_fee: Number(v.replace(/[^0-9]/g, '')) || 0 })} keyboardType="numeric" />
      <Field label={t('seller.shops.partnerName')} value={value.partner_delivery_provider ?? ''} onChangeText={(v) => onChange({ partner_delivery_provider: v })} autoCapitalize="words" />
    </>}

    {anyDelivery && <>
      <Field label={t('seller.shops.deliveryCity')} value={value.delivery_city ?? ''} onChangeText={(v) => onChange({ delivery_city: v })} autoCapitalize="words" />
      <Field label={t('seller.shops.deliveryAddress')} value={value.delivery_address ?? ''} onChangeText={(v) => onChange({ delivery_address: v })} autoCapitalize="words" />
    </>}
  </>
}

function CheckRow({ label, checked, onToggle, styles }: { label: string; checked: boolean; onToggle: () => void; styles: S }) {
  return <Pressable style={styles.checkRow} onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }}>
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked && <Text style={styles.checkboxMark}>✓</Text>}</View>
    <Text style={styles.checkLabel}>{label}</Text>
  </Pressable>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  muted: { color: colors.muted },
  small: { color: colors.muted, fontSize: 12 },
  success: { color: colors.success, fontWeight: '700' },
  error: { color: colors.danger, fontWeight: '700' },
  cardTitle: { fontSize: 17, fontWeight: '900', color: colors.ink },
  subhead: { fontSize: 15, fontWeight: '800', color: colors.ink, marginTop: spacing.xs },
  dangerCard: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.danger, gap: spacing.sm },
  typeRow: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: 'hidden' },
  typeOption: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.white },
  typeOptionActive: { backgroundColor: colors.green },
  typeLabel: { fontWeight: '800', color: colors.ink },
  typeLabelActive: { color: colors.onGreen },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shopName: { fontSize: 18, fontWeight: '900', color: colors.ink, flex: 1 },
  badge: { fontWeight: '900', fontSize: 11, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, overflow: 'hidden' },
  badgeActive: { color: colors.success, backgroundColor: colors.successSoft },
  badgeMuted: { color: colors.muted, backgroundColor: colors.surface2 },
  activeHint: { color: colors.green, fontWeight: '800', fontSize: 12 },
  link: { color: colors.green, fontWeight: '800', paddingVertical: spacing.xs },
  linkDanger: { color: colors.danger, fontWeight: '800', paddingVertical: spacing.xs },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.borderControl, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.green, borderColor: colors.green },
  checkboxMark: { color: colors.onGreen, fontSize: 13, fontWeight: '900' },
  checkLabel: { flex: 1, color: colors.ink, fontWeight: '600' },
})
