import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { sellerApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { Card, ErrorState, Loading, SectionTitle, Button } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors } from '../../src/theme'
import type { SellerSaleCommissionItem, SellerSaleCommissionDetail } from '../../src/types'

export default function SellerFinancesScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DUE' | 'COLLECTED'>('ALL')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  const summary = useQuery({
    queryKey: ['seller', 'financeSummary', activeBusiness?.id],
    queryFn: () => sellerApi.financeSummary(activeBusiness?.id),
    enabled: Boolean(activeBusiness),
  })

  const sales = useQuery({
    queryKey: ['seller', 'financeSales', activeBusiness?.id, statusFilter],
    queryFn: () => sellerApi.financeSales({
      business_id: activeBusiness?.id,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      limit: 50,
    }),
    enabled: Boolean(activeBusiness),
  })

  const saleDetail = useQuery({
    queryKey: ['seller', 'financeSaleDetail', selectedOrderId],
    queryFn: () => sellerApi.financeSaleDetail(selectedOrderId!),
    enabled: Boolean(selectedOrderId),
  })

  if (!activeBusiness) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('seller.noBusinessSelected')}</Text>
      </View>
    )
  }

  if (summary.isLoading || (sales.isLoading && !sales.data)) {
    return <Loading label={t('seller.finances.loading')} />
  }

  if (summary.isError || !summary.data) {
    return <ErrorState message={t('seller.finances.loadFailed')} retry={() => { void summary.refetch(); void sales.refetch() }} />
  }

  const s = summary.data
  const salesList = sales.data?.sales ?? []

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <SectionTitle title={t('seller.finances.title')} />
      <Text style={styles.subtitle}>{t('seller.finances.subtitle')}</Text>

      {/* KPI Cards */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>{t('seller.finances.grossSales')}</Text>
          <Text style={styles.kpiValue}>${(s.gross_sales || 0).toFixed(2)}</Text>
          <Text style={styles.kpiSub}>{t('seller.finances.verifiedSales', { count: s.sales_count || 0 })}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiLabel, { color: '#f87171' }]}>{t('seller.finances.commission')}</Text>
          <Text style={[styles.kpiValue, { color: '#f87171' }]}>-${(s.total_commission || 0).toFixed(2)}</Text>
          <Text style={styles.kpiSub}>{t('seller.finances.standardRate')}</Text>
        </View>
      </View>

      <View style={styles.kpiGrid}>
        <View style={[styles.kpiCard, styles.kpiHighlight]}>
          <Text style={[styles.kpiLabel, { color: '#34d399' }]}>{t('seller.finances.netRevenue')}</Text>
          <Text style={[styles.kpiValue, { color: '#34d399' }]}>${(s.net_revenue || 0).toFixed(2)}</Text>
          <Text style={styles.kpiSub}>{t('seller.finances.yourShare')}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiLabel, { color: '#fbbf24' }]}>{t('seller.finances.due')}</Text>
          <Text style={[styles.kpiValue, { color: '#fbbf24' }]}>${(s.commission_due || 0).toFixed(2)}</Text>
          <Text style={styles.kpiSub}>{t('seller.finances.alreadySettled', { amount: (s.commission_collected || 0).toFixed(2) })}</Text>
        </View>
      </View>

      {/* Status Filter Tabs */}
      <View style={styles.filterTabs}>
        <Pressable
          accessibilityRole="button"
          style={[styles.filterTab, statusFilter === 'ALL' && styles.filterTabActive]}
          onPress={() => setStatusFilter('ALL')}
        >
          <Text style={[styles.filterTabText, statusFilter === 'ALL' && styles.filterTabTextActive]}>{t('seller.finances.all')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={[styles.filterTab, statusFilter === 'DUE' && styles.filterTabActive]}
          onPress={() => setStatusFilter('DUE')}
        >
          <Text style={[styles.filterTabText, statusFilter === 'DUE' && styles.filterTabTextActive]}>{t('status.due')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={[styles.filterTab, statusFilter === 'COLLECTED' && styles.filterTabActive]}
          onPress={() => setStatusFilter('COLLECTED')}
        >
          <Text style={[styles.filterTabText, statusFilter === 'COLLECTED' && styles.filterTabTextActive]}>{t('seller.finances.settled')}</Text>
        </Pressable>
      </View>

      {/* Sales List */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitleText}>{t('seller.finances.history')}</Text>
      </View>

      {salesList.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>{t('seller.finances.empty')}</Text>
        </Card>
      ) : (
        salesList.map((sale) => (
          <Pressable
            key={sale.id}
            accessibilityRole="button"
            style={styles.saleRow}
            onPress={() => setSelectedOrderId(sale.order_id)}
          >
            <View style={styles.saleHeader}>
              <View>
                <Text style={styles.orderNumber}>{sale.order_number || sale.order_id.slice(0, 8)}</Text>
                <Text style={styles.saleDate}>{new Date(sale.calculated_at || sale.created_at).toLocaleDateString()}</Text>
              </View>
              <View style={[styles.badge, sale.status === 'COLLECTED' ? styles.badgeCollected : styles.badgeDue]}>
                <Text style={[styles.badgeText, sale.status === 'COLLECTED' ? styles.badgeTextCollected : styles.badgeTextDue]}>
                  {t(sale.status === 'COLLECTED' ? 'status.collected' : 'status.due')}
                </Text>
              </View>
            </View>

            <View style={styles.saleMetrics}>
              <View style={styles.saleMetricItem}>
                <Text style={styles.metricLabel}>{t('seller.finances.grossSale')}</Text>
                <Text style={styles.metricVal}>${(sale.gross_amount || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.saleMetricItem}>
                <Text style={styles.metricLabel}>{t('seller.finances.commission')} ({sale.commission_rate}%)</Text>
                <Text style={[styles.metricVal, { color: '#f87171' }]}>-${(sale.commission_amount || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.saleMetricItem}>
                <Text style={styles.metricLabel}>{t('seller.finances.netSeller')}</Text>
                <Text style={[styles.metricVal, { color: '#34d399', fontWeight: '800' }]}>${(sale.seller_net_amount || 0).toFixed(2)}</Text>
              </View>
            </View>
          </Pressable>
        ))
      )}

      {/* Sale Detail Modal */}
      <Modal
        visible={Boolean(selectedOrderId)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedOrderId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('seller.finances.detailTitle')}</Text>
              <Pressable accessibilityRole="button" onPress={() => setSelectedOrderId(null)}>
                <Ionicons name="close" size={24} color={colors.ink} />
              </Pressable>
            </View>

            {saleDetail.isLoading ? (
              <Loading label={t('seller.finances.loadingDetail')} />
            ) : saleDetail.data ? (
              <View style={styles.detailBody}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('seller.finances.orderNumber')}</Text>
                  <Text style={styles.detailValueBold}>{saleDetail.data.order_number}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('seller.finances.calculatedAt')}</Text>
                  <Text style={styles.detailValue}>{new Date(saleDetail.data.calculated_at).toLocaleString()}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('seller.finances.productAmount')}</Text>
                  <Text style={styles.detailValue}>${(saleDetail.data.gross_amount || 0).toFixed(2)}</Text>
                </View>
                {Boolean(saleDetail.data.points_discount) && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('seller.finances.pointsDiscount')}</Text>
                    <Text style={[styles.detailValue, { color: '#a78bfa' }]}>-${(saleDetail.data.points_discount || 0).toFixed(2)}</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('seller.finances.commissionBase')}</Text>
                  <Text style={styles.detailValueBold}>${(saleDetail.data.commission_base || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('seller.finances.appliedRate')}</Text>
                  <Text style={styles.detailValue}>{saleDetail.data.commission_rate}%</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('seller.finances.calculatedCommission')}</Text>
                  <Text style={[styles.detailValueBold, { color: '#f87171' }]}>-${(saleDetail.data.commission_amount || 0).toFixed(2)}</Text>
                </View>
                <View style={[styles.detailRow, styles.detailRowHighlight]}>
                  <Text style={[styles.detailLabel, { fontWeight: '800', color: '#34d399' }]}>{t('seller.finances.netSeller')}</Text>
                  <Text style={[styles.detailValueBold, { color: '#34d399', fontSize: 16 }]}>${(saleDetail.data.seller_net_amount || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('seller.finances.commissionStatus')}</Text>
                  <Text style={[styles.detailValueBold, saleDetail.data.status === 'COLLECTED' ? { color: '#34d399' } : { color: '#fbbf24' }]}>
                    {t(saleDetail.data.status === 'COLLECTED' ? 'status.collected' : 'status.due')}
                  </Text>
                </View>
                {Boolean(saleDetail.data.delivery_fee) && (
                  <Text style={styles.detailNote}>
                    {t('seller.finances.deliveryNote', { amount: (saleDetail.data.delivery_fee || 0).toFixed(2) })}
                  </Text>
                )}
                <Button
                  title={t('common.close')}
                  variant="outline"
                  onPress={() => setSelectedOrderId(null)}
                />
              </View>
            ) : (
              <Text style={styles.emptyText}>{t('seller.finances.detailFailed')}</Text>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  muted: { color: colors.muted },
  subtitle: { fontSize: 13, color: colors.muted, marginBottom: spacing.xs },
  kpiGrid: { flexDirection: 'row', gap: spacing.sm },
  kpiCard: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  kpiHighlight: { borderColor: colors.green, backgroundColor: colors.surface2 },
  kpiLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, marginBottom: 4 },
  kpiValue: { fontSize: 18, fontWeight: '900', color: colors.ink },
  kpiSub: { fontSize: 11, color: colors.muted, marginTop: 4 },
  filterTabs: { flexDirection: 'row', gap: spacing.xs, backgroundColor: colors.surface2, padding: 4, borderRadius: radius.md },
  filterTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm },
  filterTabActive: { backgroundColor: colors.white, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  filterTabText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  filterTabTextActive: { color: colors.ink, fontWeight: '700' },
  sectionHeader: { marginTop: spacing.sm },
  sectionTitleText: { fontSize: 15, fontWeight: '800', color: colors.ink },
  emptyText: { color: colors.muted, textAlign: 'center', paddingVertical: spacing.md },
  saleRow: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  saleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderNumber: { fontSize: 14, fontWeight: '800', color: colors.ink },
  saleDate: { fontSize: 12, color: colors.muted },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  badgeDue: { backgroundColor: '#78350f' },
  badgeCollected: { backgroundColor: '#065f46' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextDue: { color: '#fde68a' },
  badgeTextCollected: { color: '#6ee7b7' },
  saleMetrics: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface2, padding: spacing.sm, borderRadius: radius.sm },
  saleMetricItem: { alignItems: 'center' },
  metricLabel: { fontSize: 11, color: colors.muted },
  metricVal: { fontSize: 13, fontWeight: '700', color: colors.ink, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.md },
  modalContent: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  detailBody: { gap: spacing.sm },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailRowHighlight: { backgroundColor: colors.surface2, padding: spacing.sm, borderRadius: radius.sm, marginTop: spacing.xs },
  detailLabel: { fontSize: 13, color: colors.muted },
  detailValue: { fontSize: 13, color: colors.ink },
  detailValueBold: { fontSize: 13, fontWeight: '700', color: colors.ink },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  detailNote: { fontSize: 11, color: colors.muted, fontStyle: 'italic', marginVertical: spacing.xs },
})
