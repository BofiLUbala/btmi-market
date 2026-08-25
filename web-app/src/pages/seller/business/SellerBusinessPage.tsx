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

export default function SellerBusinessPage() {
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
    businessApi.lifecycleSummary(activeBusiness.id).then(setSummary).catch(e => setError(e instanceof Error ? e.message : 'Could not load Business summary')).finally(() => setLoading(false))
  }, [activeBusiness?.id])

  function set<K extends keyof typeof form>(key: K, value: string) { setForm(current => ({ ...current, [key]: value })) }

  async function save(e: FormEvent) {
    e.preventDefault(); if (!activeBusiness) return
    setBusy(true); setError(''); setSaved(false)
    try {
      const updated = await businessApi.update(activeBusiness.id, form)
      const businesses = sellerBusinesses.map(item => item.id === updated.id ? updated : item)
      setSellerBusinesses(businesses); setActiveBusiness(updated); setSaved(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update Business') }
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
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not archive Business') }
    finally { setBusy(false) }
  }

  if (!activeBusiness) return <Card><h2>No Active Business</h2><p className="muted">Create a Business to start selling.</p><Link to="/seller/onboarding"><Button>Create Business</Button></Link></Card>

  return <div className="seller-business business-management-page">
    <div className="page-header"><div><div className="eyebrow">CURRENT BUSINESS</div><h1>{activeBusiness.name}</h1><p className="muted">Edit business information and understand everything attached to this Business.</p></div></div>
    {error && <ErrorBox error={error} />}
    {saved && <div className="card success-box" role="status">Business information saved. All active contexts now use the new name.</div>}

    <form onSubmit={save} className="card business-info-form">
      <div className="card-header"><div><div className="eyebrow">BUSINESS INFORMATION</div><h2>Business details</h2></div><span className="badge badge-success">{activeBusiness.status}</span></div>
      <div className="business-form-grid">
        <Field label="Business Name" name="name" required value={form.name} onChange={e => set('name', e.target.value)} />
        <Field label="Business Type" name="business_type" as="select" value={form.business_type} onChange={e => set('business_type', e.target.value)} options={[{value:'RETAIL',label:'Retail'},{value:'WHOLESALE',label:'Wholesale'},{value:'MANUFACTURING',label:'Manufacturing'},{value:'SERVICES',label:'Services'},{value:'OTHER',label:'Other'}]} />
        <Field label="Category" name="category" required value={form.category} onChange={e => set('category', e.target.value)} />
        <Field label="Phone" name="phone" required value={form.phone} onChange={e => set('phone', e.target.value)} />
        <Field label="WhatsApp" name="whatsapp" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} />
        <Field label="Email" name="email" type="email" required value={form.email} onChange={e => set('email', e.target.value)} />
        <Field label="City" name="city" as="select" required value={form.city} options={drcCityOptions(form.city)} onChange={e => set('city', e.target.value)} />
        <Field label="Currency" name="default_currency" as="select" value={form.default_currency} options={[{value:'CDF',label:'CDF'},{value:'USD',label:'USD'}]} onChange={e => set('default_currency', e.target.value)} />
      </div>
      <Button type="submit" loading={busy}>Save Changes</Button>
    </form>

    <section className="card business-impact-card">
      <div className="row-between"><div><div className="eyebrow">BUSINESS SUMMARY</div><h2>Active footprint</h2></div><Link to="/seller/employees" className="section-link">View Employees →</Link></div>
      {loading ? <LoadingBlock label="Loading impact…" /> : summary && <>
        <div className="business-impact-grid"><div><span>Shops</span><strong>{summary.shops}</strong></div><div><span>Products</span><strong>{summary.products}</strong></div><div><span>Employees</span><strong>{summary.employees}</strong></div><div><span>Inventory units</span><strong>{summary.inventory_units}</strong></div><div><span>Active Orders</span><strong>{summary.active_orders}</strong></div><div><span>Historical Orders</span><strong>{summary.historical_orders}</strong></div></div>
        <div className="business-shop-summary">{summary.shop_summaries.map(shop => <Link to="/seller/shops" key={shop.id} className="business-shop-row"><div><strong>{shop.name}</strong><span>{shop.status}</span></div><span>{shop.product_count} product{shop.product_count === 1 ? '' : 's'}</span></Link>)}</div>
      </>}
    </section>

    <section className="card business-danger-zone">
      <div><div className="eyebrow">DANGER ZONE</div><h2>Archive Business</h2><p>This removes its Shops and Products from active Seller use and Marketplace visibility while preserving Orders, payments and audit history.</p></div>
      {!showArchive ? <Button variant="danger" onClick={() => setShowArchive(true)}>Delete / Archive Business</Button> : <div className="archive-confirmation">
        <h3>Archive {activeBusiness.name}?</h3>
        {summary && <p>This affects <strong>{summary.shops} Shops</strong>, <strong>{summary.products} Products</strong>, <strong>{summary.employees} Employees</strong> and <strong>{summary.inventory_units} inventory units</strong>.</p>}
        {(summary?.active_orders ?? 0) > 0 || (summary?.unresolved_payments ?? 0) > 0 ? <ErrorBox error={`Archive blocked: ${summary?.active_orders ?? 0} active Order(s) and ${summary?.unresolved_payments ?? 0} unresolved payment(s).`} /> : <p className="muted small">Historical Orders, prices, payments, reviews and stock history remain stored.</p>}
        <Field label={`Type “${activeBusiness.name}” to confirm`} name="confirm_business_name" value={confirmName} onChange={e => setConfirmName(e.target.value)} autoComplete="off" />
        <div className="archive-actions"><Button variant="ghost" onClick={() => { setShowArchive(false); setConfirmName('') }}>Cancel</Button><Button variant="danger" loading={busy} disabled={confirmName !== activeBusiness.name || (summary?.active_orders ?? 0) > 0 || (summary?.unresolved_payments ?? 0) > 0} onClick={archive}>Archive Business</Button></div>
      </div>}
    </section>
  </div>
}
