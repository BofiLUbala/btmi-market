import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AccountShell } from '../src/components/AccountShell'
import { NotificationsFeed } from '../src/components/NotificationsFeed'

/**
 * One route, two audiences: the buyer by default, the courier with
 * ?space=courier (its bell pushes that). A user can be both, and each space
 * must only ever see its own notifications.
 */
export default function NotificationsScreenRoute() {
  const { space } = useLocalSearchParams<{ space?: string }>()
  if (space === 'courier') {
    // Pushed from the courier header, outside the buyer account column.
    return (
      // Pushed over the courier tabs: it owns its own top inset.
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <NotificationsFeed
          audience="COURIER"
          space="courier"
          unreadQueryKey={['courier', 'unread-notifications']}
          onBack={() => router.back()}
        />
      </SafeAreaView>
    )
  }
  // Large screens: the account column on the left (AccountShell).
  return (
    <AccountShell>
      <NotificationsFeed audience="BUYER" space="buyer" unreadQueryKey={['buyer', 'unread-counts']} />
    </AccountShell>
  )
}
