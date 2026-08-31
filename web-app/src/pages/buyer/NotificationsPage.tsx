import { EmptyState } from '@/components/ui/Feedback'
import { useI18n } from '@/store/i18n'

export default function NotificationsPage() {
  const { t } = useI18n()
  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 12 }}>{t('notifications.title')}</h1>
      <EmptyState
        icon="🔔"
        title={t('notifications.empty.title')}
        description={t('notifications.empty.description')}
      />
    </div>
  )
}