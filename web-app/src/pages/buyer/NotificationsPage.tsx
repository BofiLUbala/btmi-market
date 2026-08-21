import { EmptyState } from '@/components/ui/Feedback'

export default function NotificationsPage() {
  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 12 }}>Notifications</h1>
      <EmptyState
        icon="🔔"
        title="No notifications yet"
        description="Order updates and promotional messages will appear here. The marketplace has no notification service yet, so nothing is shown."
      />
    </div>
  )
}