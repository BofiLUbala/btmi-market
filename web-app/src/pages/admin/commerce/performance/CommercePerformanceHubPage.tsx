import { useState } from 'react'
import { Link } from 'react-router-dom'
import SellerPerformancePage from './SellerPerformancePage'
import ShopPerformancePage from './ShopPerformancePage'
import CategoryPerformancePage from './CategoryPerformancePage'
import ProductPerformancePage from './ProductPerformancePage'
import { useT } from '@/store/i18n'
import { BoxIcon, BarChartIcon } from '@/components/ui/Icons'

type TabType = 'sellers' | 'shops' | 'products' | 'categories'

export default function CommercePerformanceHubPage() {
  const t = useT()
  const [activeTab, setActiveTab] = useState<TabType>('sellers')

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📈</span> {t('admin.commerce.performanceHubTitle')}
          </h2>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, margin: 0 }}>
            {t('admin.commerce.performanceHubSubtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            to="/admin/commerce/orders"
            style={{
              backgroundColor: 'var(--admin-surface-2)',
              color: 'var(--admin-text)',
              border: '1px solid var(--admin-border)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <BoxIcon style={{ width: 16, height: 16, marginRight: 6, verticalAlign: 'middle' }} /> {t('admin.commerce.orders')}
          </Link>
          <Link
            to="/admin/commerce/inventory"
            style={{
              backgroundColor: 'var(--admin-surface-2)',
              color: 'var(--admin-text)',
              border: '1px solid var(--admin-border)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <BarChartIcon style={{ width: 16, height: 16, marginRight: 6, verticalAlign: 'middle' }} /> {t('admin.commerce.inventory')}
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--admin-border)', marginBottom: 20, overflowX: 'auto' }}>
        <button
          onClick={() => setActiveTab('sellers')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            backgroundColor: activeTab === 'sellers' ? 'var(--admin-surface-2)' : 'transparent',
            color: activeTab === 'sellers' ? 'var(--admin-primary)' : 'var(--admin-text-muted)',
            border: 'none',
            borderBottom: activeTab === 'sellers' ? '2px solid var(--admin-primary)' : '2px solid transparent',
            borderRadius: '6px 6px 0 0',
            transition: 'all 0.15s ease'
          }}
        >
          💼 {t('admin.performance.sellerTitle')}
        </button>
        <button
          onClick={() => setActiveTab('shops')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            backgroundColor: activeTab === 'shops' ? 'var(--admin-surface-2)' : 'transparent',
            color: activeTab === 'shops' ? 'var(--admin-primary)' : 'var(--admin-text-muted)',
            border: 'none',
            borderBottom: activeTab === 'shops' ? '2px solid var(--admin-primary)' : '2px solid transparent',
            borderRadius: '6px 6px 0 0',
            transition: 'all 0.15s ease'
          }}
        >
          🏪 {t('admin.performance.shopTitle')}
        </button>
        <button
          onClick={() => setActiveTab('products')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            backgroundColor: activeTab === 'products' ? 'var(--admin-surface-2)' : 'transparent',
            color: activeTab === 'products' ? 'var(--admin-primary)' : 'var(--admin-text-muted)',
            border: 'none',
            borderBottom: activeTab === 'products' ? '2px solid var(--admin-primary)' : '2px solid transparent',
            borderRadius: '6px 6px 0 0',
            transition: 'all 0.15s ease'
          }}
        >
          📦 {t('admin.performance.productTab')}
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            backgroundColor: activeTab === 'categories' ? 'var(--admin-surface-2)' : 'transparent',
            color: activeTab === 'categories' ? 'var(--admin-primary)' : 'var(--admin-text-muted)',
            border: 'none',
            borderBottom: activeTab === 'categories' ? '2px solid var(--admin-primary)' : '2px solid transparent',
            borderRadius: '6px 6px 0 0',
            transition: 'all 0.15s ease'
          }}
        >
          📂 {t('admin.performance.categoryTitle')}
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'sellers' && <SellerPerformancePage />}
        {activeTab === 'shops' && <ShopPerformancePage />}
        {activeTab === 'products' && <ProductPerformancePage />}
        {activeTab === 'categories' && <CategoryPerformancePage />}
      </div>
    </div>
  )
}
