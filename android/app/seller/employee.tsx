import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { get } from '../../src/api/client'
import { ErrorState, Loading } from '../../src/components/ui'
import { useAuth } from '../../src/store/auth'
import { useI18n, type TranslationKey } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import type { Colors } from '../../src/theme'

// Port of web-app/src/pages/seller/dashboard/EmployeeDashboardPage.tsx
// (/employee/dashboard): the employee's own workspace from GET /employees/me —
// profile, system access and the shops they are assigned to.
interface EmployeeWorkspace {
  employee: { id: string; business_id: string; linked_user_id?: string | null; first_name: string; middle_name?: string; last_name: string; phone?: string; email?: string; job_title: string; status: string }
  shops: Array<{ id: string; name: string; type?: string; city?: string }>
}

const EMPLOYEE_STATUS_KEYS: Record<string, TranslationKey> = {
  ACTIVE: 'employee.status.ACTIVE',
  INACTIVE: 'employee.status.INACTIVE',
  TERMINATED: 'employee.status.TERMINATED',
}

export default function EmployeeDashboardScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const user = useAuth((s) => s.user)
  const workspace = useQuery({ queryKey: ['employee', 'me'], queryFn: () => get<EmployeeWorkspace>('/employees/me') })

  if (workspace.isLoading) return <Loading label={t('employee.dashboard.loading')} />
  if (workspace.isError) return <ErrorState message={workspace.error instanceof Error ? workspace.error.message : t('employee.dashboard.loadFailed')} retry={() => void workspace.refetch()} />
  if (!workspace.data) return <ErrorState message={t('employee.dashboard.noData')} />

  const emp = workspace.data.employee
  const shops = Array.isArray(workspace.data.shops) ? workspace.data.shops : []
  const ok = { backgroundColor: colors.successSoft, color: colors.success }
  const warn = { backgroundColor: colors.warningSoft, color: colors.warning }

  return <ScrollView contentContainerStyle={styles.page}>
    <View>
      <Text style={styles.h1}>{t('employee.dashboard.title')}</Text>
      <Text style={styles.muted}>{t('employee.dashboard.welcome', { firstName: user?.first_name ?? '', lastName: user?.last_name ?? '' })}</Text>
    </View>

    <View style={styles.card}>
      <Text style={styles.h3}>{t('employee.dashboard.yourProfile')}</Text>
      <Text style={styles.bold}>{[emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ')}</Text>
      <Text style={styles.small}>{emp.job_title}</Text>
      <Text style={styles.small}>{emp.phone || emp.email || ''}</Text>
      <Text style={[styles.badge, emp.status === 'ACTIVE' ? ok : warn]}>{t(EMPLOYEE_STATUS_KEYS[emp.status] ?? 'employee.status.ACTIVE')}</Text>
    </View>

    <View style={styles.card}>
      <Text style={styles.h3}>{t('employee.dashboard.systemAccess')}</Text>
      {emp.linked_user_id
        ? <><Text style={[styles.badge, ok]}>{t('employee.access.enabled')}</Text><Text style={styles.small}>{t('employee.access.signInNote')}</Text></>
        : <><Text style={[styles.badge, warn]}>{t('employee.access.disabled')}</Text><Text style={styles.small}>{t('employee.access.invitationNote')}</Text></>}
    </View>

    <View style={styles.card}>
      <Text style={styles.h3}>{t('employee.dashboard.assignedShops', { count: shops.length })}</Text>
      {shops.length === 0 ? <Text style={styles.muted}>{t('employee.dashboard.noShopsAssigned')}</Text>
        : shops.map((shop) => <Text key={shop.id} style={styles.text}>• 🏪 {shop.name}{shop.city ? <Text style={styles.small}> · {shop.city}</Text> : null}</Text>)}
    </View>
  </ScrollView>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 28, gap: 16 },
  h1: { fontSize: 24, fontWeight: '700', color: c.ink },
  h3: { fontSize: 16, fontWeight: '700', color: c.ink, marginBottom: 6 },
  bold: { fontWeight: '700', color: c.ink, fontSize: 16 },
  text: { color: c.ink, fontSize: 15, marginTop: 4 },
  muted: { color: c.muted, fontSize: 15 },
  small: { color: c.muted, fontSize: 14, marginTop: 2 },
  badge: { alignSelf: 'flex-start', marginTop: 8, fontSize: 12, fontWeight: '700', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, overflow: 'hidden' },
  card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, boxShadow: '0px 1px 2px rgba(0,0,0,0.06)' },
})
