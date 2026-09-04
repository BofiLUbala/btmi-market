import { useState } from 'react'
import { adminCommerceApi, type AdminMarketplaceVisibility, type AdminShopPageControl } from '@/api/admin'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#94a3b8' }}>{title}</h4>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#f8fafc' }}>{value || '-'}</div>
    </div>
  )
}

export default function MarketplaceVisibilityPage() {
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
      setError('Failed to load visibility for this product')
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
      setError('Failed to load shop page control')
      setShopControl(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Marketplace Visibility</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Inspect product visibility and shop page control on the public marketplace.</p>
      </div>

      {error && (
        <div style={{ backgroundColor: '#7f1d1d', border: '1px solid #dc2626', borderRadius: 8, padding: 12, marginBottom: 16, color: '#fca5a5', fontSize: 13 }}>{error}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Section title="Product Visibility Lookup">
          <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Product ID</label>
              <input value={productId} onChange={(e) => setProductId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookupProduct()}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#1e293b', color: '#f8fafc', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <button onClick={lookupProduct} disabled={loading || !productId.trim()}
              style={{ padding: '8px 16px', borderRadius: 6, border: 'none', backgroundColor: '#10b981', color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading || !productId.trim() ? 'default' : 'pointer', opacity: loading || !productId.trim() ? 0.5 : 1 }}>
              Lookup
            </button>
          </div>
        </Section>

        <Section title="Shop Page Control Lookup">
          <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Shop ID</label>
              <input value={shopId} onChange={(e) => setShopId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookupShop()}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#1e293b', color: '#f8fafc', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <button onClick={lookupShop} disabled={loading || !shopId.trim()}
              style={{ padding: '8px 16px', borderRadius: 6, border: 'none', backgroundColor: '#10b981', color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading || !shopId.trim() ? 'default' : 'pointer', opacity: loading || !shopId.trim() ? 0.5 : 1 }}>
              Lookup
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
                Product {visibility.is_visible ? 'IS' : 'is NOT'} visible on Marketplace
              </div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Product ID: {visibility.product_id}</div>
            </div>
          </div>

          {visibility.reasons_not_shown && visibility.reasons_not_shown.length > 0 && (
            <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 12, marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Reasons not shown:</div>
              {visibility.reasons_not_shown.map((reason, i) => (
                <div key={i} style={{ fontSize: 13, color: '#fca5a5', marginBottom: 4 }}>• {reason}</div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
            <Field label="Product Status" value={visibility.product_status} />
            <Field label="Publication" value={visibility.publication_status} />
            <Field label="Shop Visible" value={visibility.shop_visible ? 'Yes' : 'No'} />
            <Field label="Business Active" value={visibility.business_active ? 'Yes' : 'No'} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 8 }}>
            <Field label="Total Stock" value={visibility.total_stock ?? 'N/A'} />
            <Field label="Quality Score" value={visibility.quality_score != null ? `${visibility.quality_score.toFixed(1)}%` : 'N/A'} />
            <Field label="Last Checked" value={visibility.checked_at ? new Date(visibility.checked_at).toLocaleString() : 'N/A'} />
          </div>
        </div>
      )}

      {/* Shop Page Control Result */}
      {shopControl && (
        <Section title="Shop Page Control">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 24 }}>{shopControl.page_enabled ? '🏪' : '🔒'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Shop {shopControl.shop_id}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Page is {shopControl.page_enabled ? 'ENABLED' : 'DISABLED'}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <Field label="Can Receive Orders" value={shopControl.can_receive_orders ? 'Yes' : 'No'} />
            <Field label="Can Be Searched" value={shopControl.is_searchable ? 'Yes' : 'No'} />
            <Field label="Admin Notes" value={shopControl.admin_notes || 'None'} />
          </div>
        </Section>
      )}

      {/* Empty state */}
      {!visibility && !shopControl && !loading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
          Enter a Product ID or Shop ID above to inspect marketplace visibility and page control.
        </div>
      )}
    </div>
  )
}
