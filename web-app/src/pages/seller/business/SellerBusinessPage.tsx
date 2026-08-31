import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { businessApi } from '@/api/seller'
import type { BusinessLifecycleSummary } from '@/api/types'
import { useAuth } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { drcCityOptions } from '@/lib/drcLocations'
import { useT } from '@/store/i18n'

export default function SellerBusinessPage() {
  const t = useT()
  const { activeBusiness, sellerBusinesses, setActiveBusiness, setSellerBusinesses, setActiveShop } = useAuth()
  const navigate = useNavigate()
  const [summary, setSummary] = useState<BusinessLifecycleSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [form, setForm] = useState({ name: '', business_type: 'RETAIL', category: '', phone: '', whatsapp: '', email: '', country: 'CD', city: '', default_currency: 'CDF' })

  useEffect(() => {
    if (!activeBusiness) return
    setForm({
      name: activeBusiness.name,
      business_type: activeBusiness.business_type,
      category: activeBusiness.category,
      phone: activeBusiness.phone,
      whatsapp: activeBusiness.whatsapp ?? '',
      email: activeBusiness.email ?? '',
      country: activeBusiness.country ?? 'CD',
      city: activeBusiness.city ?? '',
      default_currency: activeBusiness.default_currency ?? 'CDF',
    })
    setLoading(true); setError(''); setShowArchive(false); setConfirmName('')
    businessApi.lifecycleSummary(activeBusiness.id).then(setSummary).catch(e => setError(e instanceof Error ? e.message : t('seller.business.loadSummaryFailed'))).finally(() => setLoading(false))
  }, [activeBusiness?.id])

  function set<K extends keyof typeof form>(key: K, value: string) { setForm(current => ({ ...current, [key]: value })) }

  async function save(e: FormEvent) {
    e.preventDefault(); if (!activeBusiness) return
    setBusy(true); setError(''); setSaved(false)
    try {
      const updated = await businessApi.update(activeBusiness.id, form)
      const businesses = sellerBusinesses.map(item => item.id === updated.id ? updated : item)
      setSellerBusinesses(businesses); setActiveBusiness(updated); setSaved(true)
    } catch (e) { setError(e instanceof Error ? e.message : t('seller.business.updateFailed')) }
    finally { setBusy(false) }
  }

  async function archive() {
    if (!activeBusiness || confirmName !== activeBusiness.name) return
    setBusy(true); setError('')
    try {
      await businessApi.archive(activeBusiness.id, confirmName)
      const remaining = (await businessApi.list()).filter(b => b.id !== activeBusiness.id)
      setSellerBusinesses(remaining); setActiveShop(null)
      const next = remaining[0] ?? null
      setActiveBusiness(next)
      navigate(next ? '/seller/dashboard' : '/seller/onboarding', { replace: true })
    } catch (e) { setError(e instanceof Error ? e.message : t('seller.business.archiveFailed')) }
    finally { setBusy(false) }
  }

  if (!activeBusiness) return (
    <Card>
      <h2>{t('seller.business.noActiveBusiness')}</h2>
      <p className="muted">{t('seller.business.noActiveBusinessHint')}</p>
      <Link to="/seller/onboarding"><Button>{t('seller.onboarding.createBusiness')}</Button></Link>
    </Card>
  )

  return <div className="seller-business business-management-page">
    <div className="page-header"><div><div className="eyebrow">{t('seller.business.currentEyebrow')}</div><h1>{activeBusiness.name}</h1><p className="muted">{t('seller.business.headerSubtitle')}</p></div></div>
    {error && <ErrorBox error={error} />}
    {saved && <div className="card success-box" role="status">{t('seller.business.saved')}</div>}

    <form onSubmit={save} className="card business-info-form">
      <div className="card-header"><div><div className="eyebrow">{t('seller.business.infoEyebrow')}</div><h2>{t('seller.business.details')}</h2></div><span className="badge badge-success">{activeBusiness.status}</span></div>
      <div className="business-form-grid">
        <Field label={t('seller.business.name')} name="name" required value={form.name} onChange={e => set('name', e.target.value)} />
        <Field label={t('seller.onboarding.businessType')} name="business_type" as="select" value={form.business_type} onChange={e => set('business_type', e.target.value)} options={[{value:'RETAIL',label:t('seller.businessType.RETAIL')},{value:'WHOLESALE',label:t('seller.businessType.WHOLESALE')},{value:'MANUFACTURING',label:t('seller.businessType.MANUFACTURING')},{value:'SERVICES',label:t('seller.businessType.SERVICES')},{value:'OTHER',label:t('seller.businessType.OTHER')}]} />
        <Field label={t('seller.onboarding.category')} name="category" required value={form.category} onChange={e => set('category', e.target.value)} />
        <Field label={t('common.phone')} name="phone" required value={form.phone} onChange={e => set('phone', e.target.value)} />
        <Field label="WhatsApp" name="whatsapp" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} />
        <Field label={t('common.email')} name="email" type="email" required value={form.email} onChange={e => set('email', e.target.value)} />
        <Field label={t('common.city')} name="city" as="select" required value={form.city} options={drcCityOptions(form.city)} onChange={e => set('city', e.target.value)} />
        <Field label={t('seller.business.currency')} name="default_currency" as="select" value={form.default_currency} options={[{value:'CDF',label:'CDF'},{value:'USD',label:'USD'}]} onChange={e => set('default_currency', e.target.value)} />
      </div>
      <Button type="submit" loading={busy}>{t('common.saveChanges')}</Button>
    </form>

    <section className="card business-impact-card">
      <div className="row-between"><div><div className="eyebrow">{t('seller.business.summaryEyebrow')}</div><h2>{t('seller.business.activeFootprint')}</h2></div><Link to="/seller/employees" className="section-link">{t('seller.business.viewEmployees')}</Link></div>
      {loading ? <LoadingBlock label={t('seller.business.loadingImpact')} /> : summary && <>
        <div className="business-impact-grid"><div><span>{t('seller.shops')}</span><strong>{summary.shops}</strong></div><div><span>{t('seller.products')}</span><strong>{summary.products}</strong></div><div><span>{t('seller.employees')}</span><strong>{summary.employees}</strong></div><div><span>{t('seller.business.inventoryUnits')}</span><strong>{summary.inventory_units}</strong></div><div><span>{t('seller.business.activeOrders')}</span><strong>{summary.active_orders}</strong></div><div><span>{t('seller.business.historicalOrders')}</span><strong>{summary.historical_orders}</strong></div></div>
        <div className="business-shop-summary">{summary.shop_summaries.map(shop => <Link to="/seller/shops" key={shop.id} className="business-shop-row"><div><strong>{shop.name}</strong><span>{shop.status}</span></div><span>{t(shop.product_count === 1 ? 'seller.business.shopProductCount' : 'seller.business.shopProductCountPlural', { count: shop.product_count })}</span></Link>)}</div>
      </>}
    </section>

    <section className="card business-danger-zone">
      <div><div className="eyebrow">{t('seller.business.dangerZone')}</div><h2>{t('seller.business.archiveTitle')}</h2><p>{t('seller.business.archiveDescription')}</p></div>
      {!showArchive ? <Button variant="danger" onClick={() => setShowArchive(true)}>{t('seller.business.deleteArchive')}</Button> : <div className="archive-confirmation">
        <h3>{t('seller.business.archiveConfirm', { name: activeBusiness.name })}</h3>
        {summary && <p>{t('seller.business.archiveAffects', { shops: summary.shops, products: summary.products, employees: summary.employees, inventory: summary.inventory_units })}</p>}
        {(summary?.active_orders ?? 0) > 0 || (summary?.unresolved_payments ?? 0) > 0 ? <ErrorBox error={t('seller.business.archiveBlocked', { active: summary?.active_orders ?? 0, payments: summary?.unresolved_payments ?? 0 })} /> : <p className="muted small">{t('seller.business.archiveHistoryNote')}</p>}
        <Field label={t('seller.business.typeNameToConfirm', { name: activeBusiness.name })} name="confirm_business_name" value={confirmName} onChange={e => setConfirmName(e.target.value)} autoComplete="off" />
        <div className="archive-actions"><Button variant="ghost" onClick={() => { setShowArchive(false); setConfirmName('') }}>{t('common.cancel')}</Button><Button variant="danger" loading={busy} disabled={confirmName !== activeBusiness.name || (summary?.active_orders ?? 0) > 0 || (summary?.unresolved_payments ?? 0) > 0} onClick={archive}>{t('seller.business.archiveTitle')}</Button></div>
      </div>}
    </section>
  </div>
}
