import { Link } from 'react-router-dom'
import NotificationSettings, { type SettingsSpace } from '@/components/notifications/NotificationSettings'
import { useT } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

const BACK: Record<SettingsSpace, string> = {
  buyer: '/notifications',
  seller: '/seller/notifications',
  courier: '/courier/dashboard',
  admin: '/admin'
}

export default function NotificationSettingsPage({ space }: { space: SettingsSpace }) {
  const t = useT()
  return (
    <div className="container notif-settings-page">
      <Link to={BACK[space]} className="muted small">← {t('common.back')}</Link>
      <h1>{t('notifSettings.title' as TranslationKey)}</h1>
      <NotificationSettings space={space} />
    </div>
  )
}
