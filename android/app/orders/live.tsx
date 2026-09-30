import { Suspense, lazy, useMemo } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { buyerApi } from '../../src/api'
import { Button, ErrorState, Loading } from '../../src/components/ui'
// MapLibre is a native module: loaded only when this screen opens, so the
// rest of the app never evaluates it (and Expo Go, which lacks it, still runs).
const LiveCourierMap = lazy(() => import('../../src/components/LiveCourierMap').then((m) => ({ default: m.LiveCourierMap })))
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'

/** "Suivre le livreur en direct": the buyer's own order, while IN_TRANSIT only. */
export default function LiveCourierScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  // The order status decides whether there is anything to follow; the order
  // event stream refreshes it (useLiveOrderQueries) when the courier arrives.
  const tracking = useQuery({ queryKey: ['buyer', 'tracking', id], queryFn: () => buyerApi.tracking(id!), enabled: !!id })

  if (tracking.isLoading) return <Loading label={t('common.loading')} />
  if (tracking.isError || !tracking.data) return <ErrorState message={t('liveMap.unavailable')} retry={() => void tracking.refetch()} />

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Suspense fallback={<Loading label={t('common.loading')} />}>
        <LiveCourierMap orderId={id!} />
      </Suspense>
      <Button variant="outline" title={t('liveMap.backToOrder')} onPress={() => router.back()} />
    </ScrollView>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, backgroundColor: c.cream },
})
