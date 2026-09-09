import { useMemo, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { useAuth } from '../../src/store/auth'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'
import type { Employee } from '../../src/types'

const emptyForm = { first_name: '', middle_name: '', last_name: '', phone: '', email: '', job_title: '' }

export default function SellerEmployeesScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const activeShop = useAuth((s) => s.activeShop)

  const employees = useQuery({ queryKey: ['seller', 'employees', activeBusiness?.id], queryFn: () => sellerApi.employees(activeBusiness!.id), enabled: Boolean(activeBusiness) })
  const shops = useQuery({ queryKey: ['seller', 'shops', activeBusiness?.id], queryFn: () => sellerApi.shops(activeBusiness!.id), enabled: Boolean(activeBusiness) })

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [managingId, setManagingId] = useState<string | null>(null)
  const [assignedShopIds, setAssignedShopIds] = useState<string[]>([])
  const [inviteUrl, setInviteUrl] = useState<{ employeeId: string; url: string } | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['seller', 'employees'] })

  const create = useMutation({
    mutationFn: () => sellerApi.createEmployee(activeBusiness!.id, form),
    onMutate: () => setError(''),
    onSuccess: () => { setShowCreate(false); setForm(emptyForm); invalidate() },
    onError: (e) => setError(e instanceof ApiError ? e.message : t('seller.employees.createFailed')),
  })

  const loadAssignments = useMutation({
    mutationFn: (employeeId: string) => sellerApi.employeeShops(employeeId),
    onSuccess: (shopList) => setAssignedShopIds(shopList.map((s) => s.id)),
    onError: (e) => Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('seller.employees.assignmentsLoadFailed')),
  })

  const assign = useMutation({
    mutationFn: ({ employeeId, shopId }: { employeeId: string; shopId: string }) => sellerApi.assignEmployeeShop(employeeId, { shop_id: shopId }),
    onSuccess: (_r, vars) => setAssignedShopIds((prev) => [...prev, vars.shopId]),
    onError: (e) => Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('seller.employees.assignFailed')),
  })

  const unassign = useMutation({
    mutationFn: ({ employeeId, shopId }: { employeeId: string; shopId: string }) => sellerApi.removeEmployeeShop(employeeId, shopId),
    onSuccess: (_r, vars) => setAssignedShopIds((prev) => prev.filter((id) => id !== vars.shopId)),
    onError: (e) => Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('seller.employees.unassignFailed')),
  })

  const invite = useMutation({
    mutationFn: (employeeId: string) => sellerApi.createEmployeeInvitation(employeeId, { employee_id: employeeId }),
    onSuccess: (res, employeeId) => {
      if (res.invitation_url) setInviteUrl({ employeeId, url: res.invitation_url })
      else Alert.alert(t('common.error'), t('seller.employees.invitationNoUrl'))
    },
    onError: (e) => Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('seller.employees.invitationFailed')),
  })

  const toggleManage = (employee: Employee) => {
    setInviteUrl(null)
    if (managingId === employee.id) { setManagingId(null); return }
    setManagingId(employee.id)
    loadAssignments.mutate(employee.id)
  }

  if (!activeBusiness) return <View style={styles.center}><Text style={styles.muted}>{t('seller.noBusinessSelected')}</Text></View>
  if (employees.isLoading || shops.isLoading) return <Loading label={t('seller.employees.loading')} />
  if (employees.isError) return <ErrorState message={t('seller.employees.loadFailed')} retry={() => void employees.refetch()} />

  return <ScrollView contentContainerStyle={styles.page}>
    <SectionTitle title={t('seller.employees')} action={<Button dense title={showCreate ? t('common.cancel') : t('seller.employees.add')} onPress={() => setShowCreate((v) => !v)} />} />
    {error ? <Text style={styles.error}>{error}</Text> : null}

    {showCreate && <Card>
      <Text style={styles.cardTitle}>{t('seller.employees.addNew')}</Text>
      <Field label={t('auth.firstName')} value={form.first_name} onChangeText={(v) => setForm((f) => ({ ...f, first_name: v }))} autoCapitalize="words" />
      <Field label={t('seller.employees.middleName')} value={form.middle_name} onChangeText={(v) => setForm((f) => ({ ...f, middle_name: v }))} autoCapitalize="words" />
      <Field label={t('auth.lastName')} value={form.last_name} onChangeText={(v) => setForm((f) => ({ ...f, last_name: v }))} autoCapitalize="words" />
      <Field label={t('auth.phone')} value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" />
      <Field label={t('auth.email')} value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" />
      <Field label={t('seller.employees.jobTitle')} value={form.job_title} onChangeText={(v) => setForm((f) => ({ ...f, job_title: v }))} autoCapitalize="words" />
      <Button title={t('seller.employees.create')} loading={create.isPending} onPress={() => create.mutate()} />
    </Card>}

    {!employees.data?.length ? <Card><Text style={styles.muted}>{t('seller.employees.noneYet')}</Text></Card> : employees.data.map((employee) => {
      const managing = managingId === employee.id
      return <Card key={employee.id}>
        <View style={styles.row}>
          <Text style={styles.name}>{employee.first_name} {employee.last_name}</Text>
          <Text style={[styles.badge, employee.status !== 'ACTIVE' && styles.badgeMuted]}>{employee.status}</Text>
        </View>
        <Text style={styles.muted}>{employee.job_title}</Text>
        <Text style={styles.muted}>{employee.phone} · {employee.email}</Text>
        <Text style={styles.muted}>{employee.linked_user_id ? t('seller.employees.accessEnabled') : t('seller.employees.accessDisabled')}</Text>
        <View style={styles.row}>
          <Button variant="outline" dense title={managing ? t('seller.employees.hideShops') : t('seller.employees.assignShops')} onPress={() => toggleManage(employee)} />
          {!employee.linked_user_id && <Button dense title={t('seller.employees.inviteAccess')} loading={invite.isPending && invite.variables === employee.id} onPress={() => invite.mutate(employee.id)} />}
        </View>
        {managing && <View style={styles.assignBox}>
          {loadAssignments.isPending ? <Loading label={t('common.loading')} /> : !shops.data?.length ? <Text style={styles.muted}>{t('seller.employees.noShopsToAssign')}</Text> : shops.data.map((shop) => {
            const isAssigned = assignedShopIds.includes(shop.id)
            const busy = (assign.isPending && assign.variables?.shopId === shop.id) || (unassign.isPending && unassign.variables?.shopId === shop.id)
            return <View key={shop.id} style={styles.assignRow}>
              <Text style={styles.muted}>{shop.name}{shop.id === activeShop ? ` ${t('seller.employees.currentShop')}` : ''}</Text>
              <Button dense variant={isAssigned ? 'outline' : 'primary'} loading={busy} title={isAssigned ? t('common.remove') : t('seller.employees.assign')} onPress={() => isAssigned ? unassign.mutate({ employeeId: employee.id, shopId: shop.id }) : assign.mutate({ employeeId: employee.id, shopId: shop.id })} />
            </View>
          })}
        </View>}
        {inviteUrl?.employeeId === employee.id && <View style={styles.inviteBox}>
          <Text style={styles.muted}>{t('seller.employees.invitationLink')}</Text>
          <Text selectable style={styles.inviteUrl}>{inviteUrl.url}</Text>
        </View>}
      </Card>
    })}
  </ScrollView>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  muted: { color: colors.muted },
  error: { color: colors.danger, fontWeight: '700' },
  cardTitle: { fontSize: 17, fontWeight: '900', color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { fontSize: 17, fontWeight: '900', color: colors.ink },
  badge: { color: colors.green, fontWeight: '900', fontSize: 12 },
  badgeMuted: { color: colors.muted },
  assignBox: { gap: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border },
  assignRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  inviteBox: { gap: spacing.xs, paddingTop: spacing.xs },
  inviteUrl: { color: colors.green, fontSize: 12 },
})
