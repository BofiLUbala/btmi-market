export default function CommerceDashboardPage() {
  const domains = [
    { num: 9, name: 'Product Catalog Control', desc: 'Cross-business search, flag, unpublish, and archive products.' },
    { num: 10, name: 'Category Management', desc: 'Create, rename, reorder, and disable categories.' },
    { num: 11, name: 'Subcategory Management', desc: 'Parent taxonomy hierarchy and ordering control.' },
    { num: 12, name: 'Seller Attribute Suggestions', desc: 'Category-aware attribute hints for product creation.' },
    { num: 13, name: 'Product Variant Control', desc: 'SKU inspection, attribute integrity, and anomaly detection.' },
    { num: 14, name: 'Shop-Scoped Inventory', desc: 'Physical on-hand, reserved, and available stock validation.' },
    { num: 15, name: 'Stock Movement History', desc: 'Ledger filterable by business, shop, employee, and movement type.' },
    { num: 16, name: 'Stock Anomalies', desc: 'Automated flags for negative stock and stale reservations.' },
    { num: 17, name: 'Order Management', desc: 'Platform-wide order lifecycle tracking and intervention.' },
    { num: 18, name: 'Order Synchronization', desc: 'Single-source consistency verification for buyer & seller.' },
    { num: 19, name: 'Order Lifecycle Tracking', desc: 'Delivery method stages (PICKUP / SHOP_DELIVERY / PARTNER).' },
    { num: 20, name: 'Stuck Order Detection', desc: 'Time-threshold monitoring flagging delayed fulfillment.' },
    { num: 21, name: 'Marketplace Visibility', desc: 'Inspection rule explaining why any product or shop is hidden.' },
    { num: 22, name: 'Public Shop Page Control', desc: 'Inspection of shop profile, ratings, reviews, and offer count.' },
    { num: 23, name: 'Search Control', desc: 'Query analytics, zero-result terms, and popular searches.' },
    { num: 24, name: 'Marketplace Ranking', desc: 'Redis category ranking factor transparency and tuning.' },
    { num: 25, name: 'Product Card Quality', desc: 'Detection of missing primary images and pricing anomalies.' },
    { num: 26, name: 'Discount / Promotion Control', desc: 'Live promotion verification and discount schedule review.' },
    { num: 27, name: 'Seller Performance', desc: 'Order acceptance rate, preparation time, and completion score.' },
    { num: 28, name: 'Product Performance', desc: 'Sales velocity, review sentiment, and product health.' },
    { num: 29, name: 'Category Performance', desc: 'Revenue, order volume, and search demand per category.' },
    { num: 30, name: 'Employee Operational Control', desc: 'Staff shop assignments, permissions, and compromised access revocation.' }
  ]

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>📦</span> Dashboard 2 — Commerce & Operations
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
          Control the complete commerce chain: Product Catalog → Taxonomy → Inventory → Order Lifecycle → Fulfillment.
        </p>
      </div>

      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🏗️</span>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: '#34d399' }}>Phase 2 Commerce Modules Mapped (22 Control Domains)</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
              Foundation shell active. The 22 Commerce & Operations domains are scheduled for full rollout in Phase 2 with live PostgreSQL hooks.
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {domains.map((d) => (
          <div key={d.num} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399', backgroundColor: '#064e3b', padding: '2px 8px', borderRadius: 6 }}>
                Domain #{d.num}
              </span>
              <span style={{ fontSize: 11, color: '#64748b' }}>Phase 2</span>
            </div>
            <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 6px', color: '#f8fafc' }}>{d.name}</h4>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>{d.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
