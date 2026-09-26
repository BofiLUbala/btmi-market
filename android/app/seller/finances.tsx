import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { useColors } from '../../src/store/theme'
import type { Colors } from '../../src/theme'
import type { SaleFinanceDetail, SellerBreakdownGroup, SellerFinanceTimeseriesPoint } from '../../src/types'

// Port of web-app/src/pages/seller/finances/SellerFinancesPage.tsx. Same four
// requests with the same shared scope (payment status + date range): KPI
// dashboard, sales history (status / search, limit 50), daily time series and
// the breakdown by shop / product / variant / business; the sale summary opens
// GET /seller/finances/sales/:orderId. Refreshes every 30 s like web. Copy is
// the web page's own French text.

const money = (value: number, currency = 'USD') => {
  try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(value || 0) }
  catch { return `${(value || 0).toFixed(2)} ${currency}` }
}

const GROUP_TABS: Array<{ id: SellerBreakdownGroup; label: string }> = [
  { id: 'shop', label: 'Boutique' },
  { id: 'product', label: 'Produit' },
  { id: 'variant', label: 'Variante' },
  { id: 'business', label: 'Entreprise' },
]
const STATUS_TABS = [
  { id: '', label: 'Toutes les ventes' },
  { id: 'DUE', label: 'À reverser' },
  { id: 'COLLECTED', label: 'Déjà réglées' },
]
const PAYMENT_STATUSES = [
  { id: '', label: 'Tous les paiements' },
  { id: 'VERIFIED', label: 'Paiement vérifié' },
  { id: 'PAID', label: 'Payé' },
  { id: 'PENDING', label: 'En attente' },
  { id: 'CONFIRMED', label: 'Confirmé' },
  { id: 'REFUNDED', label: 'Remboursé' },
]
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default function SellerFinancesScreen() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('')
  const [breakdownGroup, setBreakdownGroup] = useState<SellerBreakdownGroup>('shop')
  const [selectedSale, setSelectedSale] = useState<SaleFinanceDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(false)

  // Every request carries the same scope, so the KPI cards, the chart and the
  // sales table are three views of one server-side population (as on web).
  // A date is only sent once it is a complete YYYY-MM-DD, like an <input type=date>.
  const scope = useMemo(() => ({
    payment_status: paymentStatusFilter || undefined,
    date_from: DATE_RE.test(dateFrom) ? dateFrom : undefined,
    date_to: DATE_RE.test(dateTo) ? dateTo : undefined,
  }), [paymentStatusFilter, dateFrom, dateTo])

  const dashboard = useQuery({ queryKey: ['seller', 'finances', 'dashboard', scope], queryFn: () => sellerApi.financeDashboard(scope), refetchInterval: 30_000 })
  const sales = useQuery({
    queryKey: ['seller', 'finances', 'sales', scope, statusFilter, searchQuery],
    queryFn: () => sellerApi.financeSalesHistory({ ...scope, status: statusFilter || undefined, search: searchQuery || undefined, limit: 50 }),
    refetchInterval: 30_000,
  })
  const trend = useQuery({ queryKey: ['seller', 'finances', 'timeseries', scope], queryFn: () => sellerApi.financeTimeseries({ ...scope, interval: 'day' }), refetchInterval: 30_000 })
  const breakdown = useQuery({ queryKey: ['seller', 'finances', 'breakdown', scope, breakdownGroup], queryFn: () => sellerApi.financeBreakdown({ ...scope, group: breakdownGroup }) })

  const error = dashboard.isError || sales.isError || trend.isError || breakdown.isError || detailError
  const summary = dashboard.data
  const salesList = sales.data?.sales ?? []
  const total = sales.data?.total ?? 0
  const breakdownItems = breakdown.data?.items ?? []

  const aggregateMoney = (field: 'gross_sales' | 'commission_amount' | 'seller_net_amount' | 'due_commission' | 'collected_commission' | 'payments_collected' | 'payments_due') => {
    if (!summary) return ''
    if (summary.totals_by_currency?.length) return summary.totals_by_currency.map((t) => money(t[field], t.currency)).join(' · ')
    return money(summary[field], summary.currency || 'USD')
  }

  const retry = () => {
    setDetailError(false)
    void queryClient.invalidateQueries({ queryKey: ['seller', 'finances'] })
  }

  const openSale = async (orderId: string) => {
    setDetailLoading(true)
    try { setSelectedSale(await sellerApi.financeSaleFullDetail(orderId)) }
    catch { setDetailError(true) }
    finally { setDetailLoading(false) }
  }

  const kpis: Array<{ label: string; value: string; color?: string; note?: string }> = summary ? [
    { label: "Chiffre d'Affaires Brut", value: aggregateMoney('gross_sales') },
    { label: 'Commission TBK Totale', value: aggregateMoney('commission_amount'), color: '#818cf8' },
    { label: 'Revenu Net Vendeur', value: aggregateMoney('seller_net_amount'), color: '#4ade80' },
    { label: 'Commission à Reverser', value: aggregateMoney('due_commission'), color: '#eab308' },
    { label: 'Commission Déjà Réglée', value: aggregateMoney('collected_commission'), color: '#38bdf8' },
    { label: 'Paiements Encaissés', value: aggregateMoney('payments_collected'), color: '#fbbf24', note: 'réglés par les acheteurs' },
    { label: 'Paiements En Attente', value: aggregateMoney('payments_due'), color: '#fb923c', note: 'restant dû par les acheteurs' },
    { label: 'Unités Vendues', value: String(summary.units_sold), note: `${summary.verified_sales} vente(s) vérifiée(s)` },
  ] : []

  return (
    <View style={styles.flex1}>
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View>
        <Text style={styles.h2}>💳 Mes Finances & Commissions TBK</Text>
        <Text style={styles.subtitle}>Suivi financier de vos ventes réalisées, calcul de la commission TBK et décompte de votre revenu net vendeur.</Text>
      </View>

      {error && <View style={styles.alert} accessibilityRole="alert">
        <Text style={styles.alertText}>Impossible de charger les données financières.</Text>
        <Pressable accessibilityRole="button" onPress={retry} style={styles.alertButton}><Text style={styles.alertButtonText}>Réessayer</Text></Pressable>
      </View>}

      {/* KPI cards */}
      {!error && summary && <View style={styles.kpiGrid}>
        {kpis.map((kpi) => <View key={kpi.label} style={styles.card}>
          <Text style={styles.kpiLabel}>{kpi.label}</Text>
          <Text style={[styles.kpiValue, kpi.color ? { color: kpi.color } : null]}>{kpi.value}</Text>
          {kpi.note ? <Text style={styles.kpiNote}>{kpi.note}</Text> : null}
        </View>)}
      </View>}

      {/* Real series from the backend, never demo data */}
      {!error && summary && <View style={styles.card}>
        <Text style={styles.chartTitle}>Évolution (ventes · commission · net)</Text>
        <FinanceTrendChart points={trend.data?.points ?? []} colors={colors} />
      </View>}

      {/* Filters & search */}
      <View style={[styles.card, styles.filters]}>
        <View style={styles.tabRow}>
          {STATUS_TABS.map((tab) => <Chip key={tab.id} label={tab.label} active={statusFilter === tab.id} onPress={() => setStatusFilter(tab.id)} styles={styles} />)}
        </View>
        <TextInput placeholder="Rechercher par N° commande..." placeholderTextColor={colors.mutedLight} value={searchQuery} onChangeText={setSearchQuery} style={styles.input} autoCapitalize="characters" />
        <View style={styles.dateRow}>
          <TextInput placeholder="AAAA-MM-JJ" placeholderTextColor={colors.mutedLight} value={dateFrom} onChangeText={setDateFrom} style={[styles.input, styles.flex1]} keyboardType="numbers-and-punctuation" maxLength={10} accessibilityLabel="Date de début" />
          <TextInput placeholder="AAAA-MM-JJ" placeholderTextColor={colors.mutedLight} value={dateTo} onChangeText={setDateTo} style={[styles.input, styles.flex1]} keyboardType="numbers-and-punctuation" maxLength={10} accessibilityLabel="Date de fin" />
        </View>
        {/* Buyer payment status: server-side filter, independent of the commission status above */}
        <View style={styles.tabRow} accessibilityLabel="Statut de paiement">
          {PAYMENT_STATUSES.map((opt) => <Chip key={opt.id} label={opt.label} active={paymentStatusFilter === opt.id} onPress={() => setPaymentStatusFilter(opt.id)} styles={styles} />)}
        </View>
        <Text style={styles.count}>{total} vente(s) trouvée(s)</Text>
      </View>

      {/* Breakdown */}
      <View style={styles.breakdownHead}>
        <Text style={styles.breakdownLabel}>Répartition par :</Text>
        {GROUP_TABS.map((g) => <Chip key={g.id} label={g.label} active={breakdownGroup === g.id} onPress={() => setBreakdownGroup(g.id)} styles={styles} />)}
      </View>
      <Table styles={styles} columns={[
        { label: GROUP_TABS.find((g) => g.id === breakdownGroup)?.label ?? '', width: 170 },
        { label: 'Commandes', width: 100, align: 'right' },
        { label: 'Unités', width: 80, align: 'right' },
        { label: 'Vente Brute', width: 120, align: 'right' },
        { label: 'Commission TBK', width: 140, align: 'right' },
        { label: 'Net Vendeur', width: 120, align: 'right' },
      ]} empty={breakdownItems.length === 0 ? 'Aucune vente dans cette répartition.' : undefined}>
        {breakdownItems.map((item) => <View key={`${item.id || item.label}`} style={styles.tr}>
          <View style={[styles.td, { width: 170 }]}><Text style={styles.tdBold}>{item.label}</Text>{item.sub_label ? <Text style={styles.tdSub}>{item.sub_label}</Text> : null}</View>
          <Text style={[styles.td, styles.tdText, styles.right, { width: 100 }]}>{item.sales_count}</Text>
          <Text style={[styles.td, styles.tdText, styles.right, { width: 80 }]}>{item.units_sold}</Text>
          <Text style={[styles.td, styles.tdBold, styles.right, { width: 120 }]}>{money(item.gross_sales, item.currency)}</Text>
          <Text style={[styles.td, styles.tdBolder, styles.right, { width: 140, color: '#818cf8' }]}>{money(item.commission_amount, item.currency)}</Text>
          <Text style={[styles.td, styles.tdBolder, styles.right, { width: 120, color: '#4ade80' }]}>{money(item.seller_net_amount, item.currency)}</Text>
        </View>)}
      </Table>

      {/* Sales history */}
      {sales.isLoading ? <Text style={styles.placeholder}>Chargement de votre journal financier...</Text>
        : salesList.length === 0 ? <View style={styles.card}><Text style={styles.placeholder}>Aucune vente enregistrée pour le moment.</Text></View>
        : <Table styles={styles} columns={[
          { label: 'Date / Commande', width: 170 },
          { label: 'Acheteur', width: 140 },
          { label: 'Entreprise / Boutique', width: 170 },
          { label: 'Produits / Variantes', width: 240 },
          { label: 'Qté', width: 60, align: 'center' },
          { label: 'Vente Brute', width: 120, align: 'right' },
          { label: 'Taux TBK', width: 90, align: 'center' },
          { label: 'Commission TBK', width: 140, align: 'right' },
          { label: 'Net Vendeur', width: 120, align: 'right' },
          { label: 'Paiement', width: 150 },
          { label: 'Livraison', width: 140, align: 'center' },
          { label: 'Statut Commission', width: 150, align: 'center' },
          { label: 'Détail', width: 120, align: 'right' },
        ]}>
          {salesList.map((item) => {
            const collected = item.status === 'COLLECTED'
            const currency = item.currency || 'USD'
            return <View key={item.id} style={styles.tr}>
              <View style={[styles.td, { width: 170 }]}><Text style={styles.tdBolder}>#{item.order_number}</Text><Text style={styles.tdSub}>{new Date(item.calculated_at).toLocaleString()}</Text></View>
              <Text style={[styles.td, styles.tdText, { width: 140 }]}>{item.buyer_name || '—'}</Text>
              <View style={[styles.td, { width: 170 }]}><Text style={styles.tdSemi}>{item.shop_name}</Text><Text style={styles.tdSub}>{item.business_name}</Text></View>
              <View style={[styles.td, { width: 240 }]}>
                {(item.lines || []).length === 0 ? <Text style={styles.tdText}>—</Text> : (item.lines || []).map((line, i) => (
                  <Text key={`${item.id}-line-${i}`} style={styles.tdText}>
                    <Text style={styles.tdSemi}>{line.product_name || '—'}</Text>
                    {line.variant_name ? <Text style={styles.tdMuted}> · {line.variant_name}</Text> : null}
                    <Text style={styles.tdSub}> ({line.quantity} × {money(line.final_unit_price, currency)})</Text>
                  </Text>
                ))}
              </View>
              <Text style={[styles.td, styles.tdBold, styles.center, { width: 60 }]}>{item.total_quantity || 0}</Text>
              <Text style={[styles.td, styles.tdBold, styles.right, { width: 120 }]}>{money(item.gross_amount, currency)}</Text>
              <Text style={[styles.td, styles.tdBold, styles.center, { width: 90, color: colors.green }]}>{item.commission_rate.toFixed(2)}%</Text>
              <Text style={[styles.td, styles.tdBolder, styles.right, { width: 140, color: '#818cf8' }]}>{money(item.commission_amount, currency)}</Text>
              <Text style={[styles.td, styles.tdBolder, styles.right, { width: 120, color: '#4ade80' }]}>{money(item.seller_net_amount, currency)}</Text>
              <View style={[styles.td, { width: 150 }]}>
                <Text style={styles.tdSemi}>{item.payment_method || '—'}</Text>
                {item.provider ? <Text style={[styles.tdSub, { fontWeight: '600', color: colors.ink }]}>{item.provider.replace(/_/g, ' ')}</Text> : null}
                <Text style={styles.tdSub}>{item.payment_status || '—'}</Text>
                {item.payment_reference ? <Text style={[styles.tdSub, { fontSize: 10 }]}>{item.payment_reference}</Text> : null}
              </View>
              <Text style={[styles.td, styles.tdText, styles.center, { width: 140, fontSize: 12 }]}>{item.delivery_status || item.delivery_method || item.order_status || '—'}</Text>
              <View style={[styles.td, { width: 150, alignItems: 'center' }]}>
                <Text style={[styles.pill, collected ? styles.pillCollected : styles.pillDue]}>{collected ? 'Réglée' : 'À reverser'}</Text>
              </View>
              <View style={[styles.td, { width: 120, alignItems: 'flex-end' }]}>
                <Pressable accessibilityRole="button" disabled={detailLoading} onPress={() => void openSale(item.order_id)} style={styles.detailButton}>
                  <Text style={styles.detailButtonText}>🔍 Résumé</Text>
                </Pressable>
              </View>
            </View>
          })}
        </Table>}
    </ScrollView>

      {/* Sale detail modal (a plain overlay, like the drawer, so it also closes reliably on web) */}
      {selectedSale && <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Vente #{selectedSale.sale.order_number}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => setSelectedSale(null)} hitSlop={8}><Text style={styles.modalClose}>✕</Text></Pressable>
          </View>
          <ScrollView>
            <View style={styles.modalFacts}>
              <Text style={styles.fact}><Text style={styles.factKey}>Acheteur :</Text> {selectedSale.buyer_name || '—'}</Text>
              <Text style={styles.fact}><Text style={styles.factKey}>Entreprise / boutique :</Text> {selectedSale.sale.business_name} / {selectedSale.sale.shop_name}</Text>
              <Text style={styles.fact}>
                <Text style={styles.factKey}>Paiement :</Text> {selectedSale.payment_method || '—'}
                {selectedSale.provider ? ` · ${selectedSale.provider.replace(/_/g, ' ')}` : ''} · {selectedSale.payment_status || '—'}
                {selectedSale.payment_reference ? ` · réf. ${selectedSale.payment_reference}` : ''}
              </Text>
              <Text style={styles.fact}><Text style={styles.factKey}>Commande / livraison :</Text> {selectedSale.order_status} · {selectedSale.delivery_status || selectedSale.delivery_method || '—'}</Text>
              <Text style={styles.fact}><Text style={styles.factKey}>Date :</Text> {new Date(selectedSale.ordered_at).toLocaleString()}</Text>
            </View>
            <View style={styles.linesHead}>
              <Text style={[styles.lineCell, styles.flex2, styles.factKey]}>Produit / variante</Text>
              <Text style={[styles.lineCell, styles.center, styles.factKey]}>Qté</Text>
              <Text style={[styles.lineCell, styles.right, styles.factKey]}>Prix unitaire</Text>
              <Text style={[styles.lineCell, styles.right, styles.factKey]}>Total</Text>
            </View>
            {selectedSale.lines.map((line, index) => <View key={`${line.product_id}-${line.variant_id}-${index}`} style={styles.lineRow}>
              <View style={[styles.lineCellBox, styles.flex2]}><Text style={styles.lineText}>{line.product_name}</Text><Text style={styles.tdSub}>{line.variant_name || line.variant_sku || '—'}</Text></View>
              <Text style={[styles.lineCell, styles.lineText, styles.center]}>{line.quantity}</Text>
              <Text style={[styles.lineCell, styles.lineText, styles.right]}>{money(line.final_unit_price, selectedSale.sale.currency || 'USD')}</Text>
              <Text style={[styles.lineCell, styles.lineText, styles.right]}>{money(line.gross_amount, selectedSale.sale.currency || 'USD')}</Text>
            </View>)}
            <View style={styles.breakdownBox}>
              <Row k="Montant Produits Vente" v={money(selectedSale.sale.gross_amount, selectedSale.sale.currency || 'USD')} bold styles={styles} />
              <Row k="Base calcul commission" v={money(selectedSale.sale.commission_base, selectedSale.sale.currency || 'USD')} bold styles={styles} />
              <Row k="Majoration paiement" v={money(selectedSale.payment_markup, selectedSale.sale.currency || 'USD')} styles={styles} />
              <Row k="Frais de livraison" v={money(selectedSale.delivery_fee, selectedSale.sale.currency || 'USD')} styles={styles} />
              <Row k="Taux de commission TBK" v={`${selectedSale.sale.commission_rate.toFixed(2)}%`} bold color="#818cf8" styles={styles} />
              <View style={styles.sep} />
              <Row k="Commission TBK" v={`- ${money(selectedSale.sale.commission_amount, selectedSale.sale.currency || 'USD')}`} bold color="#818cf8" styles={styles} />
              <View style={styles.sep} />
              <View style={styles.rowBetween}>
                <Text style={[styles.tdBolder, { color: '#4ade80' }]}>Revenu Net Vendeur</Text>
                <Text style={[styles.tdBolder, { color: '#4ade80', fontSize: 15, fontWeight: '900' }]}>{money(selectedSale.sale.seller_net_amount, selectedSale.sale.currency || 'USD')}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.factMuted}>Statut Règlement</Text>
                <Text style={[styles.pill, selectedSale.sale.status === 'COLLECTED' ? styles.pillCollected : styles.pillDue]}>{selectedSale.sale.status === 'COLLECTED' ? 'Réglée à TBK' : 'À reverser à TBK'}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Pressable accessibilityRole="button" onPress={() => setSelectedSale(null)} style={styles.closeButton}><Text style={styles.closeButtonText}>Fermer</Text></Pressable>
            </View>
          </ScrollView>
        </View>
      </View>}
    </View>
  )
}

type S = ReturnType<typeof makeStyles>

function Chip({ label, active, onPress, styles }: { label: string; active: boolean; onPress: () => void; styles: S }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </Pressable>
}

function Row({ k, v, bold, color, styles }: { k: string; v: string; bold?: boolean; color?: string; styles: S }) {
  return <View style={styles.rowBetween}><Text style={styles.factMuted}>{k}</Text><Text style={[styles.lineText, bold && { fontWeight: '700' }, color ? { color } : null]}>{v}</Text></View>
}

/** web: `overflow-x: auto` table — fixed-width columns in a horizontal scroller. */
function Table({ columns, empty, children, styles }: { columns: Array<{ label: string; width: number; align?: 'left' | 'right' | 'center' }>; empty?: string; children?: React.ReactNode; styles: S }) {
  const width = columns.reduce((sum, c) => sum + c.width, 0)
  return <View style={styles.tableWrap}>
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={{ width }}>
        <View style={styles.thead}>
          {columns.map((c) => <Text key={c.label} numberOfLines={1} style={[styles.th, { width: c.width }, c.align === 'right' && styles.right, c.align === 'center' && styles.center]}>{c.label}</Text>)}
        </View>
        {empty ? <Text style={[styles.placeholder, { width, paddingVertical: 20 }]}>{empty}</Text> : children}
      </View>
    </ScrollView>
  </View>
}

const SERIES = [
  { key: 'gross_sales', label: 'Ventes brutes', color: '#60a5fa' },
  { key: 'commission_amount', label: 'Commission TBK', color: '#f87171' },
  { key: 'seller_net_amount', label: 'Net vendeur', color: '#34d399' },
] as const

/** Port of web's FinanceTrendChart: three polylines over the backend series,
 *  drawn with plain Views (segments + dots) since the app ships no SVG lib. */
function FinanceTrendChart({ points, colors, height = 180 }: { points: SellerFinanceTimeseriesPoint[]; colors: Colors; height?: number }) {
  const [width, setWidth] = useState(0)
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)
  if (points.length === 0) return <Text style={{ padding: 24, textAlign: 'center', fontSize: 12, color: colors.muted }}>Aucune donnée sur cette période.</Text>

  const max = Math.max(...points.map((p) => Math.max(p.gross_sales, p.commission_amount, p.seller_net_amount)), 0)
  const scaleMax = max > 0 ? max : 1
  const pad = 8
  const step = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0
  const x = (i: number) => (points.length > 1 ? pad + i * step : width / 2)
  const y = (value: number) => height - 12 - (value / scaleMax) * (height - 28)
  const currency = points[0]?.currency || 'USD'

  return <View>
    <View style={{ height, position: 'relative' }} onLayout={onLayout}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: height - 12, height: 1, backgroundColor: colors.border }} />
      {width > 0 && SERIES.map((series) => <View key={series.key} style={StyleSheet.absoluteFill} pointerEvents="none">
        {points.slice(1).map((p, i) => {
          const x1 = x(i), y1 = y(points[i][series.key]), x2 = x(i + 1), y2 = y(p[series.key])
          const len = Math.hypot(x2 - x1, y2 - y1)
          const angle = Math.atan2(y2 - y1, x2 - x1)
          return <View key={`seg-${p.period}`} style={{ position: 'absolute', left: (x1 + x2) / 2 - len / 2, top: (y1 + y2) / 2 - 1, width: len, height: 2, backgroundColor: series.color, transform: [{ rotate: `${angle}rad` }] }} />
        })}
        {points.map((p, i) => <View key={`dot-${p.period}`} style={{ position: 'absolute', left: x(i) - 2.5, top: y(p[series.key]) - 2.5, width: 5, height: 5, borderRadius: 2.5, backgroundColor: series.color }} />)}
      </View>)}
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginTop: 8 }}>
      {SERIES.map((series) => <View key={series.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 10, height: 2, backgroundColor: series.color }} />
        <Text style={{ fontSize: 11, color: colors.muted }}>{series.label}</Text>
      </View>)}
      <Text style={{ fontSize: 11, color: colors.muted, marginLeft: 'auto' }}>{points[0].period} → {points[points.length - 1].period} · max {money(scaleMax, currency)}</Text>
    </View>
  </View>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  // web: padding 24 inside the seller content area (14px 12px 28px)
  page: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 28, gap: 20 },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  h2: { fontSize: 24, fontWeight: '800', color: c.ink, marginBottom: 6 },
  subtitle: { color: c.muted, fontSize: 14 },
  alert: { padding: 18, borderRadius: 10, backgroundColor: '#450a0a', borderWidth: 1, borderColor: '#991b1b', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  alertText: { color: '#FFFFFF', fontWeight: '700' },
  alertButton: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 7, backgroundColor: '#FFFFFF' },
  alertButtonText: { color: '#111111', fontWeight: '600' },
  kpiGrid: { gap: 16 },
  card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 18 },
  kpiLabel: { fontSize: 12, color: c.muted, fontWeight: '600' },
  kpiValue: { fontSize: 22, fontWeight: '800', color: c.ink, marginTop: 4 },
  kpiNote: { fontSize: 11, color: c.muted, marginTop: 4 },
  chartTitle: { fontSize: 13, fontWeight: '700', color: c.ink, marginBottom: 10 },
  filters: { padding: 16, gap: 12 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, backgroundColor: c.surface2 },
  chipActive: { backgroundColor: c.green },
  chipText: { fontSize: 12, fontWeight: '700', color: c.muted },
  chipTextActive: { color: c.onGreen },
  input: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2, color: c.ink, fontSize: 13 },
  dateRow: { flexDirection: 'row', gap: 12 },
  count: { fontSize: 13, color: c.muted, fontWeight: '600' },
  breakdownHead: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: -10 },
  breakdownLabel: { fontSize: 13, fontWeight: '700', color: c.muted },
  tableWrap: { backgroundColor: c.white, borderRadius: 12, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  thead: { flexDirection: 'row', backgroundColor: c.surface2, borderBottomWidth: 1, borderBottomColor: c.border },
  th: { paddingVertical: 12, paddingHorizontal: 16, color: c.muted, fontWeight: '600', fontSize: 13 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border },
  td: { paddingVertical: 12, paddingHorizontal: 16 },
  tdText: { fontSize: 13, color: c.ink },
  tdSemi: { fontSize: 13, color: c.ink, fontWeight: '600' },
  tdBold: { fontSize: 13, color: c.ink, fontWeight: '700' },
  tdBolder: { fontSize: 13, color: c.ink, fontWeight: '800' },
  tdMuted: { fontSize: 13, color: c.muted },
  tdSub: { fontSize: 11, color: c.muted },
  right: { textAlign: 'right' },
  center: { textAlign: 'center' },
  pill: { fontSize: 11, fontWeight: '700', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 6, overflow: 'hidden' },
  pillCollected: { backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#16a34a' },
  pillDue: { backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#ca8a04' },
  detailButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2 },
  detailButtonText: { fontSize: 12, fontWeight: '700', color: c.ink },
  placeholder: { padding: 48, textAlign: 'center', color: c.muted },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 16, zIndex: 1000 },
  modal: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 24, maxHeight: '90%' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: c.ink },
  modalClose: { fontSize: 18, color: '#94a3b8' },
  modalFacts: { marginBottom: 16, gap: 2 },
  fact: { fontSize: 13, lineHeight: 22, color: c.ink },
  factKey: { fontWeight: '700', color: c.ink, fontSize: 12 },
  factMuted: { color: '#94a3b8', fontSize: 13 },
  linesHead: { flexDirection: 'row', paddingBottom: 4 },
  lineRow: { flexDirection: 'row', paddingVertical: 4 },
  lineCell: { flex: 1, fontSize: 12 },
  lineCellBox: { flex: 1 },
  lineText: { fontSize: 12, color: c.ink },
  breakdownBox: { backgroundColor: c.surface2, borderRadius: 10, padding: 16, marginVertical: 16, gap: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  sep: { height: 1, backgroundColor: '#334155', opacity: 0.4 },
  closeButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: c.green },
  closeButtonText: { color: c.onGreen, fontSize: 13, fontWeight: '700' },
})
