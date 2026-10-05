import { useCallback, useEffect, useMemo, useState } from 'react'
import { courierApi } from '@/api/courier'
import type { CourierDeliveredProduct, CourierEarnings } from '@/api/types'
import { dateLocale, formatMoney } from '@/lib/format'
import { useT } from '@/store/i18n'

/** Today's date where the deliveries happen (YYYY-MM-DD). */
export function kinshasaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kinshasa' }).format(new Date())
}

/** "82,00 $ · 10 000 FC": one amount per currency, or 0 in the default one. */
export function cashLabel(earnings: CourierEarnings | null): string {
  const cash = earnings?.cash_collected ?? []
  return cash.length ? cash.map((c) => formatMoney(c.amount, c.currency)).join(' · ') : formatMoney(0)
}

/**
 * "Produits livrés": the cash the courier took at the door on a chosen day,
 * and every product they delivered (that day, or all days).
 */
export function CourierDeliveredPanel() {
  const t = useT()
  const [day, setDay] = useState(kinshasaToday)
  const [allDays, setAllDays] = useState(false)
  const [earnings, setEarnings] = useState<CourierEarnings | null>(null)
  const [items, setItems] = useState<CourierDeliveredProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [e, p] = await Promise.all([
        courierApi.getEarnings(day),
        courierApi.getDeliveredProducts(allDays ? undefined : day),
      ])
      setEarnings(e)
      setItems(Array.isArray(p) ? p : [])
    } catch {
      setError(t('courierCourierDeliveredPanel.loadError'))
    } finally {
      setLoading(false)
    }
  }, [day, allDays, t])

  useEffect(() => { void load() }, [load])

  // One card per order, its products listed inside.
  const orders = useMemo(() => {
    const byOrder = new Map<string, CourierDeliveredProduct[]>()
    for (const it of items) byOrder.set(it.order_id, [...(byOrder.get(it.order_id) ?? []), it])
    return [...byOrder.values()]
  }, [items])

  const isToday = day === kinshasaToday()
  const date = new Date(`${day}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <section className="courier-glass courier-section">
        <div className="courier-heading courier-delivered-heading">
          <div>
            <p className="courier-eyebrow">{t('courierCourierDeliveredPanel.cashEyebrow')}</p>
            <h2>{isToday ? t('courierCourierDeliveredPanel.cashedToday') : t('courierCourierDeliveredPanel.cashedOn', { date })}</h2>
          </div>
          <label className="courier-day-picker">
            <span>{t('courierCourierDeliveredPanel.day')}</span>
            <input type="date" value={day} max={kinshasaToday()} onChange={(e) => e.target.value && setDay(e.target.value)} />
          </label>
        </div>
        {error && <div className="courier-alert courier-alert-error"><span>{error}</span><button onClick={() => void load()}>{t('common.retry')}</button></div>}
        <div className="courier-earnings">
          <div className="courier-earnings-total">
            <small>{t('courierCourierDeliveredPanel.cashFromBuyers')}</small>
            <strong>{loading && !earnings ? '…' : cashLabel(earnings)}</strong>
            <span>{t((earnings?.cash_orders ?? 0) === 1 ? 'courierCourierDeliveredPanel.cashPaymentsOne' : 'courierCourierDeliveredPanel.cashPaymentsOther', { count: earnings?.cash_orders ?? 0 })}</span>
          </div>
          <div className="courier-earnings-figures">
            <div><strong>{earnings?.orders_delivered ?? 0}</strong><small>{t('courierCourierDeliveredPanel.ordersDelivered')}</small></div>
            <div><strong>{earnings?.items_delivered ?? 0}</strong><small>{t('courierCourierDeliveredPanel.itemsDelivered')}</small></div>
          </div>
        </div>
      </section>

      <section className="courier-glass courier-section">
        <div className="courier-heading courier-delivered-heading">
          <div>
            <p className="courier-eyebrow">{t(items.length === 1 ? 'courierCourierDeliveredPanel.itemsOne' : 'courierCourierDeliveredPanel.itemsOther', { count: items.length })}</p>
            <h2>{allDays ? t('courierCourierDeliveredPanel.deliveredAllDays') : isToday ? t('courierCourierDeliveredPanel.deliveredToday') : t('courierCourierDeliveredPanel.deliveredOn', { date })}</h2>
          </div>
          <label className="courier-all-days">
            <input type="checkbox" checked={allDays} onChange={(e) => setAllDays(e.target.checked)} />
            <span>{t('courierCourierDeliveredPanel.allDays')}</span>
          </label>
        </div>
        {loading && !items.length ? (
          <p className="courier-muted">{t('common.loading')}</p>
        ) : orders.length === 0 ? (
          <div className="courier-empty"><strong>{allDays ? t('courierCourierDeliveredPanel.emptyAll') : isToday ? t('courierCourierDeliveredPanel.emptyToday') : t('courierCourierDeliveredPanel.emptyOn', { date })}</strong><p>{t('courierCourierDeliveredPanel.emptyHint')}</p></div>
        ) : (
          <div className="courier-delivered-list">
            {orders.map((lines) => {
              const head = lines[0]
              const total = lines.reduce((sum, l) => sum + l.line_total, 0)
              return (
                <article key={head.order_id} className="courier-delivered-order">
                  <header>
                    <div>
                      <strong>{t('courierCourierDeliveredPanel.orderNumber', { number: head.order_number })}</strong>
                      <span>{head.shop_name} · {new Date(head.delivered_at).toLocaleString(dateLocale(), { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                    <div className="courier-delivered-amount">
                      <strong>{formatMoney(total, head.currency)}</strong>
                      <span className={head.cash_collected ? 'is-cash' : ''}>
                        {head.cash_collected ? t('courierCourierDeliveredPanel.cashCollected') : head.payment_method === 'CASH_ON_DELIVERY' ? t('courierCourierDeliveredPanel.cash') : t('courierCourierDeliveredPanel.paidOnline')}
                      </span>
                    </div>
                  </header>
                  <ul>
                    {lines.map((l, i) => (
                      <li key={`${l.order_id}-${i}`}>
                        {l.image_url ? <img src={l.image_url} alt="" loading="lazy" /> : <span className="courier-delivered-thumb" aria-hidden="true" />}
                        <div>
                          <strong>{l.product_name}</strong>
                          {l.variant_name && <small>{l.variant_name}</small>}
                        </div>
                        <span>× {l.quantity}</span>
                        <b>{formatMoney(l.line_total, l.currency)}</b>
                      </li>
                    ))}
                  </ul>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
