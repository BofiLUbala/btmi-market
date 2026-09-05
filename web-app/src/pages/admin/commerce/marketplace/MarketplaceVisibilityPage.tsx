import { useState } from 'react'
import { adminCommerceApi, type AdminMarketplaceVisibility, type AdminShopPageControl } from '@/api/admin'
import { useT } from '@/store/i18n'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#94a3b8' }}>{title}</h4>
      {children}
    </div>
  )
}

function Field({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: color || '#f8fafc' }}>{value != null ? value : '-'}</div>
    </div>
  )
}

export default function MarketplaceVisibilityPage() {
  const t = useT()
  const [productId, setProductId] = useState('')
  const [shopId, setShopId] = useState('')
  const [visibility, setVisibility] = useState<AdminMarketplaceVisibility | null>(null)
  const [shopControl, setShopControl] = useState<AdminShopPageControl | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const lookupProduct = async () => {
    if (!productId.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await adminCommerceApi.getMarketplaceVisibility(productId.trim())
      setVisibility(res)
    } catch (err) {
      setError(t('admin.marketplace.errorLoadVisibility'))
      setVisibility(null)
    } finally {
      setLoading(false)
    }
  }

  const lookupShop = async () => {
    if (!shopId.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await adminCommerceApi.getShopPageControl(shopId.trim())
      setShopControl(res)
    } catch (err) {
      setError(t('admin.marketplace.errorLoadShopControl'))
      setShopControl(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{t('admin.marketplace.title')}</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{t('admin.marketplace.subtitle')}</p>
      </div>

      {error && (
        <div style={{ backgroundColor: '#7f1d1d', border: '1px solid #dc2626', borderRadius: 8, padding: 12, marginBottom: 16, color: '#fca5a5', fontSize: 13 }}>{error}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Section title={t('admin.marketplace.productLookupTitle')}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>{t('admin.marketplace.productId')}</label>
              <input value={productId} onChange={(e) => setProductId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookupProduct()}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#1e293b', color: '#f8fafc', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <button onClick={lookupProduct} disabled={loading || !productId.trim()}
              style={{ padding: '8px 16px', borderRadius: 6, border: 'none', backgroundColor: '#10b981', color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading || !productId.trim() ? 'default' : 'pointer', opacity: loading || !productId.trim() ? 0.5 : 1 }}>
              {t('admin.marketplace.lookup')}
            </button>
          </div>
        </Section>

        <Section title={t('admin.marketplace.shopLookupTitle')}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>{t('admin.marketplace.shopId')}</label>
              <input value={shopId} onChange={(e) => setShopId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookupShop()}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#1e293b', color: '#f8fafc', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <button onClick={lookupShop} disabled={loading || !shopId.trim()}
              style={{ padding: '8px 16px', borderRadius: 6, border: 'none', backgroundColor: '#10b981', color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading || !shopId.trim() ? 'default' : 'pointer', opacity: loading || !shopId.trim() ? 0.5 : 1 }}>
              {t('admin.marketplace.lookup')}
            </button>
          </div>
        </Section>
      </div>

      {/* Product Visibility Result */}
      {visibility && (
        <div style={{
          backgroundColor: visibility.is_visible ? '#064e3b' : '#7f1d1d',
          border: `1px solid ${visibility.is_visible ? '#10b981' : '#dc2626'}`,
          borderRadius: 10, padding: 16, marginBottom: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 24 }}>{visibility.is_visible ? '✅' : '🚫'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {visibility.is_visible ? t('admin.marketplace.productIsVisible') : t('admin.marketplace.productIsNotVisible')}
              </div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>{t('admin.marketplace.productIdLabel', { id: visibility.product_id })}</div>
            </div>
          </div>

          {visibility.reasons_not_shown && visibility.reasons_not_shown.length > 0 && (
            <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 12, marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{t('admin.marketplace.reasonsNotShown')}</div>
              {visibility.reasons_not_shown.map((reason, i) => (
                <div key={i} style={{ fontSize: 13, color: '#fca5a5', marginBottom: 4 }}>• {reason}</div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
            <Field label={t('admin.marketplace.productStatus')} value={visibility.product_status} />
            <Field label={t('admin.marketplace.publication')} value={visibility.publication_status} />
            <Field label={t('admin.marketplace.shopStatus')} value={visibility.shop_status} />
            <Field label={t('admin.marketplace.businessStatus')} value={visibility.business_status} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 8 }}>
            <Field label={t('admin.marketplace.stockAvailable')} value={visibility.stock_available} color={visibility.stock_available > 0 ? '#34d399' : '#ef4444'} />
            <Field label={t('admin.marketplace.shopOfferStatus')} value={visibility.shop_offer_status || 'ACTIVE'} />
            <Field label={t('admin.marketplace.policyStatus')} value={visibility.policy_status || 'PASS'} />
            <Field label={t('admin.marketplace.moderationStatus')} value={visibility.moderation_status || 'APPROVED'} />
          </div>
        </div>
      )}

      {/* Shop Page Control Result */}
      {shopControl && (
        <Section title={t('admin.marketplace.shopPageControl')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 24 }}>{shopControl.marketplace_visibility ? '🏪' : '🔒'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{shopControl.shop_name} ({shopControl.business_name})</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                {shopControl.marketplace_visibility
                  ? t('admin.marketplace.visibilityEnabledStatus', { status: shopControl.status })
                  : t('admin.marketplace.visibilityDisabledStatus', { status: shopControl.status })}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <Field label={t('admin.marketplace.productsPubTotal')} value={`${shopControl.published_products} / ${shopControl.product_count}`} />
            <Field label={t('admin.marketplace.rating')} value={`★ ${shopControl.rating.toFixed(1)} (${shopControl.review_count})`} color="#fbbf24" />
            <Field label={t('admin.marketplace.location')} value={shopControl.location || t('admin.marketplace.notSet')} />
            <Field label={t('admin.marketplace.activeCategories')} value={shopControl.active_categories?.join(', ') || t('admin.common.none')} />
          </div>
        </Section>
      )}

      {/* Empty state */}
      {!visibility && !shopControl && !loading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
          {t('admin.marketplace.emptyState')}
        </div>
      )}
    </div>
  )
}
