import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { useAuth } from '../../src/store/auth'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'
import type { Shop } from '../../src/types'

const emptyForm = { name: '', type: 'PHYSICAL' as 'PHYSICAL' | 'ONLINE', city: '', address: '', phone: '' }

export default function SellerShopsScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const activeShop = useAuth((s) => s.activeShop)
  const setActiveShop = useAuth((s) => s.setActiveShop)

  const shops = useQuery({ queryKey: ['seller', 'shops', activeBusiness?.id], queryFn: () => sellerApi.shops(activeBusiness!.id), enabled: Boolean(activeBusiness) })
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<Shop | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState('')

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['seller', 'shops'] })

  const create = useMutation({
    mutationFn: () => sellerApi.createShop(activeBusiness!.id, form),
    onMutate: () => setError(''),
    onSuccess: () => { setShowCreate(false); setForm(emptyForm); invalidate() },
    onError: (e) => setError(e instanceof ApiError ? e.message : t('seller.shops.createFailed')),
  })

  const update = useMutation({
    mutationFn: () => sellerApi.updateShop(editing!.id, { name: editName }),
    onMutate: () => setError(''),
    onSuccess: () => { setEditing(null); invalidate() },
    onError: (e) => setError(e instanceof ApiError ? e.message : t('seller.shops.updateFailed')),
  })

  const remove = useMutation({
    mutationFn: (shop: Shop) => sellerApi.deleteShop(shop.id),
    onMutate: () => setError(''),
    onSuccess: () => invalidate(),
    onError: (e) => setError(e instanceof ApiError ? e.message : t('seller.shops.deleteFailed')),
  })

  const restore = useMutation({
    mutationFn: (shop: Shop) => sellerApi.updateShop(shop.id, { status: 'ACTIVE' }),
    onSuccess: () => invalidate(),
    onError: (e) => setError(e instanceof ApiError ? e.message : t('seller.shops.restoreFailed')),
  })

  if (!activeBusiness) return <View style={styles.center}><Text style={styles.muted}>{t('seller.noBusinessSelected')}</Text></View>
  if (shops.isLoading) return <Loading label={t('seller.shops.loading')} />
  if (shops.isError) return <ErrorState message={t('seller.shops.loadFailed')} retry={() => void shops.refetch()} />

  return <ScrollView contentContainerStyle={styles.page}>
    <SectionTitle title={t('seller.shops')} action={<Button dense title={showCreate ? t('common.cancel') : t('seller.shops.createShop')} onPress={() => setShowCreate((v) => !v)} />} />
    {error ? <Text style={styles.error}>{error}</Text> : null}

    {showCreate && <Card>
      <Text style={styles.cardTitle}>{t('seller.shops.createTitle')}</Text>
      <Field label={t('seller.shops.name')} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} autoCapitalize="words" />
      <View style={styles.typeRow}>
        <Pressable style={[styles.typeOption, form.type === 'PHYSICAL' && styles.typeOptionActive]} onPress={() => setForm((f) => ({ ...f, type: 'PHYSICAL' }))}><Text style={[styles.typeLabel, form.type === 'PHYSICAL' && styles.typeLabelActive]}>{t('seller.shopTypePhysical')}</Text></Pressable>
        <Pressable style={[styles.typeOption, form.type === 'ONLINE' && styles.typeOptionActive]} onPress={() => setForm((f) => ({ ...f, type: 'ONLINE' }))}><Text style={[styles.typeLabel, form.type === 'ONLINE' && styles.typeLabelActive]}>{t('seller.shopTypeOnline')}</Text></Pressable>
      </View>
      <Field label={t('seller.city')} value={form.city} onChangeText={(v) => setForm((f) => ({ ...f, city: v }))} autoCapitalize="words" />
      <Field label={t('seller.address')} value={form.address} onChangeText={(v) => setForm((f) => ({ ...f, address: v }))} autoCapitalize="words" />
      <Field label={t('auth.phone')} value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" />
      <Button title={t('seller.shops.createSubmit')} loading={create.isPending} onPress={() => create.mutate()} />
    </Card>}

    {editing && <Card>
      <Text style={styles.cardTitle}>{t('seller.shops.settings')}</Text>
      <Field label={t('seller.shops.name')} value={editName} onChangeText={setEditName} autoCapitalize="words" />
      <Button title={t('common.save')} loading={update.isPending} onPress={() => update.mutate()} />
      <Button variant="outline" title={t('common.cancel')} onPress={() => setEditing(null)} />
    </Card>}

    {!shops.data?.length ? <Card><Text style={styles.muted}>{t('seller.shops.noShopsYet')}</Text></Card> : shops.data.map((shop) => {
      const archived = shop.status !== 'ACTIVE'
      return <Card key={shop.id}>
        <View style={styles.row}>
          <Text style={styles.shopName}>{shop.name}</Text>
          {shop.id === activeShop && <Text style={styles.activeBadge}>{t('seller.shops.active')}</Text>}
        </View>
        <Text style={styles.muted}>{[shop.city, shop.address].filter(Boolean).join(' — ') || shop.type}</Text>
        {!archived && <Button variant="outline" dense title={t('seller.shops.setActive')} onPress={() => setActiveShop(shop.id)} />}
        <Pressable onPress={() => router.push({ pathname: '/seller/products' } as any)}><Text style={styles.link}>{t('seller.productList.openShop') as any}</Text></Pressable>
        <View style={styles.row}>
          {!archived ? <>
            <Pressable onPress={() => { setEditing(shop); setEditName(shop.name) }}><Text style={styles.link}>{t('seller.shops.settings')}</Text></Pressable>
            <Pressable onPress={() => remove.mutate(shop)}><Text style={styles.linkDanger}>{t('seller.shops.deleteArchive')}</Text></Pressable>
          </> : <Pressable onPress={() => restore.mutate(shop)}><Text style={styles.link}>{t('seller.shops.restoreShop')}</Text></Pressable>}
        </View>
      </Card>
    })}
  </ScrollView>
}

import { router } from 'expo-router'

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  muted: { color: colors.muted },
  error: { color: colors.danger, fontWeight: '700' },
  cardTitle: { fontSize: 17, fontWeight: '900', color: colors.ink },
  typeRow: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' },
  typeOption: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.white },
  typeOptionActive: { backgroundColor: colors.green },
  typeLabel: { fontWeight: '800', color: colors.ink },
  typeLabelActive: { color: colors.white },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shopName: { fontSize: 18, fontWeight: '900', color: colors.ink },
  activeBadge: { color: colors.green, fontWeight: '900', fontSize: 12 },
  link: { color: colors.green, fontWeight: '800', paddingVertical: spacing.xs },
  linkDanger: { color: colors.danger, fontWeight: '800', paddingVertical: spacing.xs },
})
