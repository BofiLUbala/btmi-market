import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { Card, ErrorState, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors } from '../../src/theme'

export default function SellerGrowthScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const growth = useQuery({ queryKey: ['seller', 'growth', activeBusiness?.id], queryFn: () => sellerApi.growthLevel(activeBusiness!.id), enabled: Boolean(activeBusiness) })

  if (!activeBusiness) return <View style={styles.center}><Text style={styles.muted}>{t('seller.noBusinessSelected')}</Text></View>
  if (growth.isLoading) return <Loading label={t('seller.growth.loading')} />
  if (growth.isError || !growth.data) return <ErrorState message={t('seller.growth.loadFailed')} retry={() => void growth.refetch()} />

  const g = growth.data
  const progress = Math.min(100, Math.max(0, g.level.progress_to_next_level_percent))

  return <ScrollView contentContainerStyle={styles.page}>
    <SectionTitle title={t('seller.growth.title')} />
    <View style={styles.grid}>
      <Card><Text style={styles.cardTitle}>{t('seller.growth.currentPoints')}</Text><Text style={styles.metric}>{g.points.current_points.toLocaleString()}</Text><Text style={styles.muted}>{t('seller.growth.lifetime', { count: g.points.lifetime_points.toLocaleString() })}</Text></Card>
      <Card><Text style={styles.cardTitle}>{t('seller.growth.currentLevel')}</Text><Text style={styles.metric}>{g.level.name}</Text><Text style={styles.muted}>{t('seller.growth.searchBoost', { value: g.level.search_boost })}</Text></Card>
    </View>
    <Card>
      <Text style={styles.cardTitle}>{t('seller.growth.trustStatus')}</Text>
      <Text style={styles.badge}>{t(`seller.growth.trust.${g.trust.trust_status}` as any)}</Text>
    </Card>
    <Card>
      <Text style={styles.cardTitle}>{t('seller.growth.progressToNextLevel')}</Text>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
      <Text style={styles.muted}>{t('seller.growth.pointsProgress', { current: g.points.current_points.toLocaleString(), max: g.level.max_points.toLocaleString(), description: g.level.description })}</Text>
    </Card>
    <Card>
      <Text style={styles.cardTitle}>{t('seller.growth.trustMetrics')}</Text>
      <View style={styles.grid}><Metric label={t('seller.growth.verifiedSales')} value={String(g.trust.verified_sales_count)} styles={styles} /><Metric label={t('seller.growth.completionRate')} value={`${g.trust.order_completion_rate.toFixed(1)}%`} styles={styles} /></View>
      <View style={styles.grid}><Metric label={t('seller.growth.cancellationRate')} value={`${g.trust.cancellation_rate.toFixed(1)}%`} styles={styles} /><Metric label={t('seller.growth.confirmationRate')} value={`${g.trust.purchase_confirmation_rate.toFixed(1)}%`} styles={styles} /></View>
      <View style={styles.grid}><Metric label={t('seller.growth.stockReliability')} value={`${g.trust.stock_reliability_rate.toFixed(1)}%`} styles={styles} /></View>
    </Card>
    <Card>
      <Text style={styles.cardTitle}>{t('seller.growth.levelBenefits')}</Text>
      {g.benefits.map((b) => {
        const key = `seller.growth.benefit.${b.benefit_type}`
        // Falls back to a humanized enum for any benefit_type the backend
        // adds later that this dictionary hasn't caught up with yet, instead
        // of ever showing the raw translation key to a seller.
        const translated = t(key as any)
        const label = translated === key ? b.benefit_type.split('_').join(' ') : translated
        return <Text key={b.benefit_type} style={styles.muted}>✓ {label}{b.benefit_value > 0 ? ` (${b.benefit_value})` : ''}</Text>
      })}
    </Card>
  </ScrollView>
}

function Metric({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof makeStyles> }) {
  return <Card><Text style={styles.metric}>{value}</Text><Text style={styles.muted}>{label}</Text></Card>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  muted: { color: colors.muted },
  cardTitle: { fontSize: 15, fontWeight: '900', color: colors.ink },
  metric: { fontSize: 20, fontWeight: '900', color: colors.green },
  grid: { flexDirection: 'row', gap: spacing.sm },
  badge: { color: colors.green, fontWeight: '900' },
  progressTrack: { height: 10, borderRadius: radius.sm, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.green },
})
