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
              <div style={{ fontSize: 48, fontWeight: 800, color: scoreColor(quality.quality_score) }}>
                {quality.quality_score.toFixed(0)}%
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Product ID: {quality.product_id}</div>
            </div>

            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#94a3b8' }}>Warnings ({quality.warnings?.length ?? 0})</h4>
              {quality.warnings && quality.warnings.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {quality.warnings.map((w, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', backgroundColor: '#1e293b', borderRadius: 6 }}>
                      <span style={{ color: '#fbbf24', fontSize: 14 }}>⚠</span>
                      <span style={{ color: '#f8fafc', fontSize: 13 }}>{w}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#34d399', fontSize: 13, padding: 12, textAlign: 'center' }}>No warnings - card quality is good!</div>
              )}
            </div>
          </div>

          {/* Checklist */}
          {quality.checklist && (
            <Section title="Quality Checklist">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {Object.entries(quality.checklist).map(([key, passed]) => (
                  <div key={key} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                    backgroundColor: passed ? '#064e3b' : '#7f1d1d', borderRadius: 6
                  }}>
                    <span style={{ fontSize: 14 }}>{passed ? '✅' : '❌'}</span>
                    <span style={{ color: '#f8fafc', fontSize: 13, fontWeight: 500 }}>
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}
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
