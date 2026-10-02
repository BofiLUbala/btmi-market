import { useCallback, useEffect, useState } from 'react'
import { useT } from '@/store/i18n'
import { ErrorBox, LoadingBlock, SuccessBox } from '@/components/ui/Feedback'
import type { TranslationKey } from '@/locales/fr'
import {
  enablePush,
  notificationSettingsApi,
  pushState,
  releasePush,
  type NotificationCategory,
  type NotificationPreference,
  type PushDevice,
  type PushScope,
  type PushState
} from '@/lib/push'

export type SettingsSpace = 'buyer' | 'seller' | 'courier' | 'admin'

/** The categories that make sense in each space, in display order. */
const CATEGORIES: Record<SettingsSpace, NotificationCategory[]> = {
  buyer: ['ORDERS', 'PAYMENTS', 'MESSAGES', 'WATCHLIST', 'MARKETING', 'SECURITY'],
  seller: ['ORDERS', 'PAYMENTS', 'MESSAGES', 'SHOP', 'SECURITY'],
  courier: ['ORDERS', 'MESSAGES', 'SECURITY'],
  admin: ['ADMIN', 'MESSAGES', 'SECURITY']
}

const AUDIENCE: Record<SettingsSpace, string> = { buyer: 'BUYER', seller: 'SELLER', courier: 'COURIER', admin: 'ADMIN' }

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export default function NotificationSettings({ space }: { space: SettingsSpace }) {
  const t = useT()
  const tk = (key: string, vars?: Record<string, string | number>) => t(key as TranslationKey, vars)
  const scope: PushScope = space === 'admin' ? 'admin' : 'user'
  const [prefs, setPrefs] = useState<NotificationPreference[] | null>(null)
  const [devices, setDevices] = useState<PushDevice[]>([])
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [p, d, s] = await Promise.all([
        notificationSettingsApi.preferences(scope),
        notificationSettingsApi.devices(scope),
        pushState(scope)
      ])
      setPrefs(p.items)
      setDevices(d.items)
      setState(s)
    } catch (err) {
      setError(errorText(err))
    }
  }, [scope])

  useEffect(() => { void load() }, [load])

  async function run(key: string, fn: () => Promise<void>, success?: string) {
    setBusy(key)
    setError('')
    setNotice('')
    try {
      await fn()
      if (success) setNotice(success)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  const updatePref = (category: NotificationCategory, body: { push_enabled?: boolean; consent?: boolean }) =>
    run(category, async () => {
      const next = await notificationSettingsApi.update(scope, category, body)
      setPrefs((list) => list?.map((p) => (p.category === category ? next : p)) ?? null)
    }, t('notifSettings.saved' as TranslationKey))

  if (!prefs && !error) return <LoadingBlock />

  const shown = (prefs ?? []).filter((p) => CATEGORIES[space].includes(p.category))
    .sort((a, b) => CATEGORIES[space].indexOf(a.category) - CATEGORIES[space].indexOf(b.category))

  const stateText: Record<PushState, string> = {
    on: tk('notifSettings.device.on'),
    off: tk('notifSettings.device.off'),
    denied: tk('notifSettings.device.denied'),
    unsupported: tk('notifSettings.device.unsupported'),
    'ios-install': tk('notifSettings.device.ios'),
    'other-account': tk('notifSettings.device.otherAccount')
  }

  return (
    <div className="notif-settings">
      <p className="muted">{tk('notifSettings.intro')}</p>
      {error && <ErrorBox error={error} onRetry={() => void load()} />}
      {notice && <SuccessBox message={notice} />}

      <section className="card notif-settings-section" aria-labelledby="notif-device-title">
        <h2 id="notif-device-title">{tk('notifSettings.device.title')}</h2>
        {state && <p className={state === 'on' ? '' : 'muted'}>{stateText[state]}</p>}
        <div className="notif-settings-actions">
          {(state === 'off' || state === 'other-account') && (
            <button type="button" className="btn btn-primary" disabled={busy !== null}
              onClick={() => run('device', async () => { setState(await enablePush(scope)); await load() })}>
              {tk('notifSettings.device.enable')}
            </button>
          )}
          {state === 'on' && (
            <>
              <button type="button" className="btn btn-secondary" disabled={busy !== null}
                onClick={() => run('test', () => notificationSettingsApi.test(scope, AUDIENCE[space]).then(() => undefined), tk('notifSettings.device.testSent'))}>
                {tk('notifSettings.device.test')}
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy !== null}
                onClick={() => run('device', async () => { await releasePush(scope); await load() })}>
                {tk('notifSettings.device.disable')}
              </button>
            </>
          )}
        </div>
        {state === 'on' && <p className="muted small">{tk('notifSettings.device.background')}</p>}
      </section>

      <section className="card notif-settings-section" aria-labelledby="notif-cat-title">
        <h2 id="notif-cat-title">{tk('notifSettings.categories.title')}</h2>
        <ul className="notif-pref-list">
          {shown.map((p) => {
            const label = tk(`notifSettings.cat.${p.category}`)
            const desc = tk(space === 'courier' && p.category === 'ORDERS' ? 'notifSettings.cat.ORDERS.courier' : `notifSettings.cat.${p.category}.desc`)
            return (
              <li key={p.category} className="notif-pref">
                <div className="notif-pref-text">
                  <strong>{label}</strong>
                  <span className="muted small">{desc}</span>
                  {p.locked && <span className="muted small">{tk('notifSettings.locked')}</span>}
                  {p.requires_consent && (
                    <label className="notif-consent">
                      <input
                        type="checkbox"
                        checked={p.consented}
                        disabled={busy !== null}
                        onChange={(e) => void updatePref(p.category, { consent: e.target.checked })}
                      />
                      <span>{tk('notifSettings.consent')}</span>
                    </label>
                  )}
                  {p.requires_consent && (
                    <span className="muted small">
                      {tk('notifSettings.consentNote', { cap: tk(p.category === 'WATCHLIST' ? 'notifSettings.cap.watchlist' : 'notifSettings.cap.marketing') })}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-label={label}
                  aria-checked={p.push_enabled}
                  disabled={busy !== null || p.locked || (p.requires_consent && !p.consented)}
                  className={`toggle-switch ${p.push_enabled ? 'on' : ''}`}
                  onClick={() => void updatePref(p.category, { push_enabled: !p.push_enabled })}
                >
                  <span />
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card notif-settings-section" aria-labelledby="notif-devices-title">
        <h2 id="notif-devices-title">{tk('notifSettings.devices.title')}</h2>
        {devices.length === 0 ? (
          <p className="muted">{tk('notifSettings.devices.empty')}</p>
        ) : (
          <ul className="notif-device-list">
            {devices.map((d) => (
              <li key={d.id} className="notif-device">
                <div>
                  <strong>{d.device_label || tk(d.platform === 'WEB' ? 'notifSettings.devices.web' : 'notifSettings.devices.app')}</strong>
                  <span className="muted small">
                    {tk(d.platform === 'WEB' ? 'notifSettings.devices.web' : 'notifSettings.devices.app')}
                    {d.last_success_at && ` · ${tk('notifSettings.devices.lastSuccess', { date: new Date(d.last_success_at).toLocaleString('fr-FR') })}`}
                  </span>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null}
                  onClick={() => run(d.id, async () => { await notificationSettingsApi.removeDevice(scope, d.id); await load() })}>
                  {tk('notifSettings.devices.remove')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
