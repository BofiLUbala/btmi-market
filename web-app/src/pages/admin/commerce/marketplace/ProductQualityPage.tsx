import { useState } from 'react'
import { adminCommerceApi, type AdminProductCardQuality } from '@/api/admin'

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
      <div style={{ fontSize: 14, color: color || '#f8fafc' }}>{value || '-'}</div>
    </div>
  )
}

export default function ProductQualityPage() {
  const [productId, setProductId] = useState('')
  const [quality, setQuality] = useState<AdminProductCardQuality | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const lookup = async () => {
    if (!productId.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await adminCommerceApi.getProductCardQuality(productId.trim())
      setQuality(res)
    } catch (err) {
      setError('Failed to load product card quality')
      setQuality(null)
    } finally {
      setLoading(false)
    }
  }

  const computeQualityScore = (q: AdminProductCardQuality) => {
    let score = 0
    if (q.has_primary_image) score += 30
    if (q.has_effective_price) score += 25
    if (q.has_regular_price) score += 15
    if (q.availability === 'IN_STOCK') score += 15
    if (q.issues.length === 0) score += 15
    return score
  }

  const scoreColor = (score: number) => {
    if (score >= 80) return '#34d399'
    if (score >= 60) return '#fbbf24'
    if (score >= 40) return '#f97316'
    return '#ef4444'
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Product Card Quality</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Inspect product card quality score and missing data warnings.</p>
      </div>

      {error && (
        <div style={{ backgroundColor: '#7f1d1d', border: '1px solid #dc2626', borderRadius: 8, padding: 12, marginBottom: 16, color: '#fca5a5', fontSize: 13 }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'end' }}>
        <div style={{ flex: 1, maxWidth: 400 }}>
          <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Product ID</label>
          <input value={productId} onChange={(e) => setProductId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookup()}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        <button onClick={lookup} disabled={loading || !productId.trim()}
          style={{ padding: '8px 16px', borderRadius: 6, border: 'none', backgroundColor: '#10b981', color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading || !productId.trim() ? 'default' : 'pointer', opacity: loading || !productId.trim() ? 0.5 : 1 }}>
          {loading ? 'Checking...' : 'Check Quality'}
        </button>
      </div>

      {quality && (
        <>
          {/* Score Overview */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 16 }}>
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Quality Score</div>
              <div style={{ fontSize: 48, fontWeight: 800, color: scoreColor(computeQualityScore(quality)) }}>
                {computeQualityScore(quality)}%
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', marginTop: 8 }}>{quality.product_name}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Shop: {quality.shop_name || '-'}</div>
            </div>

            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#94a3b8' }}>Issues ({quality.issues?.length ?? 0})</h4>
              {quality.issues && quality.issues.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {quality.issues.map((issue, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', backgroundColor: '#1e293b', borderRadius: 6 }}>
                      <span style={{ color: '#fbbf24', fontSize: 14 }}>⚠</span>
                      <span style={{ color: '#f8fafc', fontSize: 13 }}>{issue}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#34d399', fontSize: 13, padding: 12, textAlign: 'center' }}>No issues found - product card quality is optimal!</div>
              )}
            </div>
          </div>

          {/* Checklist */}
          <Section title="Quality Criteria Checklist">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {[
                { label: 'Primary Image Present', passed: quality.has_primary_image },
                { label: 'Effective Price Defined', passed: quality.has_effective_price },
                { label: 'Regular Price Defined', passed: quality.has_regular_price },
                { label: 'In Stock Availability', passed: quality.availability === 'IN_STOCK' },
                { label: 'Off-Badge Integrity', passed: !quality.has_off_badge || quality.discount_percent > 0 },
                { label: 'No Catalog Data Issues', passed: quality.issues.length === 0 },
              ].map((item) => (
                <div key={item.label} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  backgroundColor: item.passed ? '#064e3b' : '#7f1d1d', borderRadius: 6
                }}>
                  <span style={{ fontSize: 14 }}>{item.passed ? '✅' : '❌'}</span>
                  <span style={{ color: '#f8fafc', fontSize: 13, fontWeight: 500 }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          {/* Pricing & Media Details */}
          <Section title="Card Attributes">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <Field label="Effective Price" value={`$${quality.effective_price.toFixed(2)}`} />
              <Field label="Regular Price" value={`$${quality.regular_price.toFixed(2)}`} />
              <Field label="Discount" value={quality.has_off_badge ? `${quality.discount_percent.toFixed(1)}% OFF` : 'None'} color={quality.has_off_badge ? '#34d399' : undefined} />
              <Field label="Availability" value={quality.availability} color={quality.availability === 'IN_STOCK' ? '#34d399' : '#fbbf24'} />
              <Field label="Image Count" value={quality.image_count} />
              <Field label="Rating" value={`★ ${quality.rating.toFixed(1)} (${quality.review_count} reviews)`} color="#fbbf24" />
              <Field label="Primary Image URL" value={quality.primary_image_url || 'None'} />
              <Field label="Product ID" value={quality.product_id} />
            </div>
          </Section>
        </>
      )}

      {!quality && !loading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
          Enter a Product ID above to check its card quality score and warnings.
        </div>
      )}
    </div>
  )
}

