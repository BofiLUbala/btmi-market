import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminCommerceApi, type AdminProductDetail } from '@/api/admin'

function ActionModal({ title, onConfirm, onCancel }: { title: string; onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>{title}</h3>
        <textarea
          placeholder="Reason (minimum 5 characters)..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{
            width: '100%', minHeight: 80, padding: 10, borderRadius: 8, border: '1px solid #334155',
            backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13, resize: 'vertical', boxSizing: 'border-box'
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onCancel} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#cbd5e1', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button
            onClick={() => reason.length >= 5 && onConfirm(reason)}
            disabled={reason.length < 5}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none',
              backgroundColor: reason.length >= 5 ? '#dc2626' : '#334155',
              color: '#fff', cursor: reason.length >= 5 ? 'pointer' : 'default',
              fontSize: 13, fontWeight: 600
            }}
          >Confirm</button>
        </div>
      </div>
    </div>
  )
}

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

export default function CommerceProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<AdminProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionModal, setActionModal] = useState<'unpublish' | 'archive' | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    adminCommerceApi.getProduct(id)
      .then(setProduct)
      .catch(() => navigate('/admin/commerce/products'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleAction = async (action: 'unpublish' | 'archive', reason: string) => {
    if (!id) return
    setActionLoading(true)
    try {
      if (action === 'unpublish') await adminCommerceApi.unpublishProduct(id, reason)
      else await adminCommerceApi.archiveProduct(id, reason)
      const refreshed = await adminCommerceApi.getProduct(id)
      setProduct(refreshed)
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
      setActionModal(null)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading product...</div>
  if (!product) return <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>Product not found</div>

  const { product: p, business_name, category_name, subcategory_name, variants, images, inventory, visibility_report } = product

  return (
    <div>
      {actionModal && (
        <ActionModal
          title={actionModal === 'unpublish' ? 'Unpublish Product' : 'Archive Product'}
          onConfirm={(reason) => handleAction(actionModal, reason)}
          onCancel={() => setActionModal(null)}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <button onClick={() => navigate('/admin/commerce/products')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13, marginBottom: 4 }}>&larr; Back to Products</button>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{p.name}</h2>
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>SKU: {p.sku || 'N/A'} &middot; ID: {p.id}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {p.publication_status === 'PUBLISHED' && (
            <button onClick={() => setActionModal('unpublish')} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #f59e0b', backgroundColor: 'transparent', color: '#f59e0b', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Unpublish</button>
          )}
          {p.publication_status !== 'ARCHIVED' && (
            <button onClick={() => setActionModal('archive')} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #dc2626', backgroundColor: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Archive</button>
          )}
        </div>
      </div>

      {/* Visibility Banner */}
      <div style={{
        backgroundColor: visibility_report.is_visible ? '#064e3b' : '#7f1d1d',
        border: `1px solid ${visibility_report.is_visible ? '#10b981' : '#dc2626'}`,
        borderRadius: 10, padding: 16, marginBottom: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>{visibility_report.is_visible ? '✅' : '🚫'}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {visibility_report.is_visible ? 'Visible on Marketplace' : 'NOT Visible on Marketplace'}
            </div>
            {visibility_report.reasons_not_shown?.length > 0 && (
              <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 4 }}>
                {visibility_report.reasons_not_shown.map((r, i) => <div key={i}>• {r}</div>)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Left Column */}
        <div>
          <Section title="Product Identity">
            <Field label="Name" value={p.name} />
            <Field label="SKU" value={p.sku} />
            <Field label="Description" value={p.description || 'No description'} />
            <Field label="Unit" value={p.unit} />
            <Field label="Business" value={business_name} />
            <Field label="Category" value={category_name} />
            <Field label="Subcategory" value={subcategory_name} />
            <Field label="Status" value={p.status} />
            <Field label="Publication" value={p.publication_status} />
            <Field label="Created" value={new Date(p.created_at).toLocaleString()} />
          </Section>

          <Section title="Images">
            {images && images.length > 0 ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {images.map(img => (
                  <div key={img.id} style={{ position: 'relative' }}>
                    <img src={img.url} alt={img.file_name} style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', border: img.is_primary ? '2px solid #10b981' : '1px solid #334155' }} />
                    {img.is_primary && <span style={{ position: 'absolute', top: 4, left: 4, fontSize: 9, fontWeight: 700, backgroundColor: '#10b981', color: '#fff', padding: '1px 5px', borderRadius: 4 }}>PRIMARY</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: 13 }}>No images uploaded</div>
            )}
          </Section>
        </div>

        {/* Right Column */}
        <div>
          <Section title="Pricing">
            <Field label="Regular Price" value={`$${p.unit_price.toFixed(2)}`} />
            {p.discount_active && (
              <>
                <Field label="Discount" value={`${p.discount_type} - ${p.discount_value}`} />
                <Field label="Effective Price" value={`$${(p.unit_price - (p.discount_type === 'PERCENTAGE' ? p.unit_price * p.discount_value / 100 : p.discount_value)).toFixed(2)}`} />
              </>
            )}
          </Section>

          <Section title="Variants">
            {variants && variants.length > 0 ? (
              <table style={{ width: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155' }}>
                    {['SKU', 'Name', 'Attributes', 'Sale Price', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: '#94a3b8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {variants.map(v => (
                    <tr key={v.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '6px 8px', color: '#f8fafc' }}>{v.sku}</td>
                      <td style={{ padding: '6px 8px', color: '#f8fafc' }}>{v.name}</td>
                      <td style={{ padding: '6px 8px', color: '#94a3b8' }}>{Object.entries(v.attributes || {}).map(([k, val]) => `${k}: ${val}`).join(', ') || '-'}</td>
                      <td style={{ padding: '6px 8px', color: '#f8fafc' }}>${v.sale_price.toFixed(2)}</td>
                      <td style={{ padding: '6px 8px' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, backgroundColor: v.status === 'ACTIVE' ? '#064e3b' : '#334155', color: v.status === 'ACTIVE' ? '#a7f3d0' : '#94a3b8' }}>{v.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: '#64748b', fontSize: 13 }}>No variants defined</div>
            )}
          </Section>

          <Section title="Inventory per Shop">
            {inventory && inventory.length > 0 ? (
              <table style={{ width: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155' }}>
                    {['Shop', 'Variant', 'On Hand', 'Reserved', 'Available'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: '#94a3b8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((inv, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '6px 8px', color: '#f8fafc' }}>{inv.shop_name}</td>
                      <td style={{ padding: '6px 8px', color: '#94a3b8' }}>{inv.variant_name || inv.sku}</td>
                      <td style={{ padding: '6px 8px', color: '#f8fafc' }}>{inv.quantity}</td>
                      <td style={{ padding: '6px 8px', color: '#fbbf24' }}>{inv.reserved_quantity}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 700, color: inv.available > 0 ? '#34d399' : '#ef4444' }}>{inv.available}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: '#64748b', fontSize: 13 }}>No inventory records</div>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}
