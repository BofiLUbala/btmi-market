import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PushSessionSync from '@/components/notifications/PushSessionSync'
import NotificationOpenPage from '@/pages/notifications/NotificationOpenPage'
import NotificationSettingsPage from '@/pages/notifications/NotificationSettingsPage'
import { PresenceBeacon } from '@/lib/presence'
import { AuthProvider } from '@/store/auth'
import { AdminAuthProvider } from '@/store/adminAuth'
import { FavoritesProvider } from '@/store/favorites'
import { CartProvider } from '@/store/cart'
import { ThemeProvider } from '@/store/theme'
import { I18nProvider, useI18n } from '@/store/i18n'
import { Button } from '@/components/ui/Button'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { RequireAdminAuth, RequireAdminRole, AdminPublicOnly } from '@/components/admin/AdminGuards'
import { AdminHomeRedirect } from '@/components/admin/AdminHomeRedirect'
import AdminLoginPage from '@/pages/admin/auth/AdminLoginPage'
import AdminActivatePage from '@/pages/admin/auth/AdminActivatePage'
import DirectionDashboardPage from '@/pages/admin/direction/DirectionDashboardPage'
import AdminUsersPage from '@/pages/admin/direction/AdminUsersPage'
import CommerceDashboardPage from '@/pages/admin/commerce/CommerceDashboardPage'
import CommerceSellersPage from '@/pages/admin/commerce/sellers/CommerceSellersPage'
import CommerceBusinessesPage from '@/pages/admin/commerce/businesses/CommerceBusinessesPage'
import CommerceShopsPage from '@/pages/admin/commerce/shops/CommerceShopsPage'
import CommerceShopsAnalyticsPage from '@/pages/admin/commerce/shops/CommerceShopsAnalyticsPage'
import CommerceDeliveriesPage from '@/pages/admin/commerce/deliveries/CommerceDeliveriesPage'
import CommerceCouriersPage from '@/pages/admin/commerce/couriers/CommerceCouriersPage'
import CommerceDeliveryAssignmentsPage from '@/pages/admin/commerce/deliveries/CommerceDeliveryAssignmentsPage'
import CommercePerformanceHubPage from '@/pages/admin/commerce/performance/CommercePerformanceHubPage'
import CommerceProductsPage from '@/pages/admin/commerce/products/CommerceProductsPage'
import CommerceProductDetailPage from '@/pages/admin/commerce/products/CommerceProductDetailPage'
import CommerceCategoriesPage from '@/pages/admin/commerce/categories/CommerceCategoriesPage'
import InventoryListPage from '@/pages/admin/commerce/inventory/InventoryListPage'
import StockHistoryPage from '@/pages/admin/commerce/inventory/StockHistoryPage'
import OrderListPage from '@/pages/admin/commerce/orders/OrderListPage'
import AdminOrderDetailPage from '@/pages/admin/commerce/orders/OrderDetailPage'
import MarketplaceVisibilityPage from '@/pages/admin/commerce/marketplace/MarketplaceVisibilityPage'
import MarketplaceRankingPage from '@/pages/admin/commerce/marketplace/MarketplaceRankingPage'
import SearchAdminPage from '@/pages/admin/commerce/marketplace/SearchAdminPage'
import ProductQualityPage from '@/pages/admin/commerce/marketplace/ProductQualityPage'
import PromotionVisibilityPage from '@/pages/admin/commerce/marketplace/PromotionVisibilityPage'
import EmployeeManagementPage from '@/pages/admin/commerce/employees/EmployeeManagementPage'
import SellerPerformancePage from '@/pages/admin/commerce/performance/SellerPerformancePage'
import CategoryPerformancePage from '@/pages/admin/commerce/performance/CategoryPerformancePage'
import ShopPerformancePage from '@/pages/admin/commerce/performance/ShopPerformancePage'
import ProductPerformancePage from '@/pages/admin/commerce/performance/ProductPerformancePage'
import FinanceDashboardPage from '@/pages/admin/finance/FinanceDashboardPage'
import CommissionManagementPage from '@/pages/admin/finance/CommissionManagementPage'
import DeliveryFeesPage from '@/pages/admin/finance/DeliveryFeesPage'
import TechnicalDashboardPage from '@/pages/admin/technical/TechnicalDashboardPage'
import FeatureFlagsPage from '@/pages/admin/platform/FeatureFlagsPage'
import GlobalConfigPage from '@/pages/admin/platform/GlobalConfigPage'
import AdvancedManagementPage from '@/pages/admin/platform/AdvancedManagementPage'





import CommerceOrderCommunicationsPage from '@/pages/admin/commerce/communications/CommerceOrderCommunicationsPage'
import CourierInvitePage from '@/pages/admin/commerce/couriers/CourierInvitePage'
import { CompassIcon } from '@/components/ui/Icons'

function NotFound() {
  const { t } = useI18n()
  return (
    <div className="empty-state" style={{ padding: '64px 0' }}>
      <div className="empty-icon"><CompassIcon className="empty-svg" /></div>
      <h3>{t('notFound.title')}</h3>
      {/* A plain anchor, not a Link. web-app is no longer the site: it is
          served under /admin and a few token screens, while the marketplace
          at / is the Expo app. A client-side Link changed the URL to / but
          stayed inside web-app, so "Back to marketplace" landed the visitor
          on web-app's own home in the old palette. A real navigation asks
          the server, which serves whatever the marketplace root actually is
          — the site here, and web-app's own home when it runs standalone. */}
      <a href="/">
        <Button>{t('notFound.backToMarketplace')}</Button>
      </a>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <I18nProvider>
      <AuthProvider>
        <FavoritesProvider>
          <CartProvider>
            <AdminAuthProvider>
            <PresenceBeacon />
            <PushSessionSync />
            <Routes>
              {/* Every push notification click lands here first. */}
              <Route path="/notif/:id" element={<NotificationOpenPage />} />

              {/* Admin Control Center Routes */}
              <Route element={<AdminPublicOnly />}>
                <Route path="/admin/login" element={<AdminLoginPage />} />
              </Route>
              <Route path="/admin/activate" element={<AdminActivatePage />} />

              <Route element={<RequireAdminAuth />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<AdminHomeRedirect />} />
                  <Route path="/admin/notifications/settings" element={<NotificationSettingsPage space="admin" />} />
                  <Route element={<RequireAdminRole allowedRoles={['DIRECTION_ADMIN', 'SUPER_ADMIN']} />}>
                    <Route path="/admin/direction" element={<DirectionDashboardPage />} />
                    {/* Features are routes, not local tab state, so the sidebar
                        can mark one active and a refresh lands back on it. */}
                    <Route path="/admin/direction/:feature" element={<DirectionDashboardPage />} />
                  </Route>
                  <Route element={<RequireAdminRole allowedRoles={['SUPER_ADMIN']} />}>
                    <Route path="/admin/admin-users" element={<AdminUsersPage />} />
                    <Route path="/admin/users" element={<Navigate to="/admin/admin-users" replace />} />
                  </Route>
                  <Route element={<RequireAdminRole allowedRoles={['COMMERCE_ADMIN', 'SUPER_ADMIN']} />}>
                    <Route path="/admin/commerce" element={<CommerceDashboardPage />} />
                    <Route path="/admin/commerce/sellers" element={<CommerceSellersPage />} />
                    <Route path="/admin/commerce/businesses" element={<CommerceBusinessesPage />} />
                    <Route path="/admin/commerce/shops" element={<CommerceShopsPage />} />
                    <Route path="/admin/commerce/shops/analytics" element={<CommerceShopsAnalyticsPage />} />
                    <Route path="/admin/commerce/products" element={<CommerceProductsPage />} />
                    <Route path="/admin/commerce/products/:id" element={<CommerceProductDetailPage />} />
                    <Route path="/admin/commerce/categories" element={<CommerceCategoriesPage />} />
                    <Route path="/admin/commerce/inventory" element={<InventoryListPage />} />
                    <Route path="/admin/commerce/inventory/history" element={<StockHistoryPage />} />
                    <Route path="/admin/commerce/employees" element={<EmployeeManagementPage />} />
                    <Route path="/admin/commerce/orders" element={<OrderListPage />} />
                    <Route path="/admin/commerce/orders/:id" element={<AdminOrderDetailPage />} />
                    <Route path="/admin/commerce/communications" element={<CommerceOrderCommunicationsPage />} />
                    <Route path="/admin/commerce/deliveries" element={<CommerceDeliveriesPage />} />
                    <Route path="/admin/commerce/couriers" element={<CommerceCouriersPage />} />
                    <Route path="/admin/commerce/couriers/invite" element={<CourierInvitePage />} />
                    <Route path="/admin/commerce/delivery-assignments" element={<CommerceDeliveryAssignmentsPage />} />
                    <Route path="/admin/commerce/marketplace/visibility" element={<MarketplaceVisibilityPage />} />
                    <Route path="/admin/commerce/marketplace/ranking" element={<MarketplaceRankingPage />} />
                    <Route path="/admin/commerce/marketplace/search" element={<SearchAdminPage />} />
                    <Route path="/admin/commerce/marketplace/quality" element={<ProductQualityPage />} />
                    <Route path="/admin/commerce/marketplace/promotions" element={<PromotionVisibilityPage />} />
                    <Route path="/admin/commerce/performance" element={<CommercePerformanceHubPage />} />
                    <Route path="/admin/commerce/performance/sellers" element={<SellerPerformancePage />} />
                    <Route path="/admin/commerce/performance/categories" element={<CategoryPerformancePage />} />
                    <Route path="/admin/commerce/performance/shops" element={<ShopPerformancePage />} />
                    <Route path="/admin/commerce/performance/products" element={<ProductPerformancePage />} />
                  </Route>
                  <Route element={<RequireAdminRole allowedRoles={['FINANCE_SUPPORT_ADMIN', 'SUPER_ADMIN']} />}>
                    <Route path="/admin/finance" element={<FinanceDashboardPage />} />
                    <Route path="/admin/finance/commissions" element={<CommissionManagementPage />} />
                    <Route path="/admin/finance/delivery-fees" element={<DeliveryFeesPage />} />
                    <Route path="/admin/finance/:feature" element={<FinanceDashboardPage />} />
                  </Route>
                  <Route element={<RequireAdminRole allowedRoles={['TECHNICAL_ADMIN', 'SUPER_ADMIN']} />}>
                    <Route path="/admin/technical" element={<TechnicalDashboardPage />} />
                    <Route path="/admin/technical/:feature" element={<TechnicalDashboardPage />} />
                  </Route>
                  <Route element={<RequireAdminRole allowedRoles={['SUPER_ADMIN']} />}>
                    <Route path="/admin/platform/feature-flags" element={<FeatureFlagsPage />} />
                    <Route path="/admin/platform/config" element={<GlobalConfigPage />} />
                    <Route path="/admin/platform/advanced" element={<AdvancedManagementPage />} />
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
            </AdminAuthProvider>
          </CartProvider>
        </FavoritesProvider>
      </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
