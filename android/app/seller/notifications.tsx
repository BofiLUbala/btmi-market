import { NotificationsFeed } from '../../src/components/NotificationsFeed'

/** The seller's own notifications; the navy header and drawer come from the layout. */
export default function SellerNotificationsScreen() {
  // Prefix key: SellerHeader's bell keys on shop and business too.
  return <NotificationsFeed audience="SELLER" space="seller" unreadQueryKey={['seller', 'unreadCounts']} />
}
