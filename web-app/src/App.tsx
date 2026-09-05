import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/store/auth'
import { AdminAuthProvider } from '@/store/adminAuth'
import { FavoritesProvider } from '@/store/favorites'
import { CartProvider } from '@/store/cart'
import { ThemeProvider } from '@/store/theme'
import { I18nProvider, useI18n } from '@/store/i18n'
import { Layout } from '@/components/layout/Layout'
import { PublicOnly, RequireAuth, RequireBuyer, RequireSeller, RequireEmployee, SellerIndexRedirect } from '@/components/auth/Guards'
import { Button } from '@/components/ui/Button'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { RequireAdminAuth, RequireAdminRole, AdminPublicOnly } from '@/components/admin/AdminGuards'
import AdminLoginPage from '@/pages/admin/auth/AdminLoginPage'
import AdminActivatePage from '@/pages/admin/auth/AdminActivatePage'
import DirectionDashboardPage from '@/pages/admin/direction/DirectionDashboardPage'
import AdminUsersPage from '@/pages/admin/direction/AdminUsersPage'
import CommerceDashboardPage from '@/pages/admin/commerce/CommerceDashboardPage'
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
import FinanceDashboardPage from '@/pages/admin/finance/FinanceDashboardPage'
import TechnicalDashboardPage from '@/pages/admin/technical/TechnicalDashboardPage'
import FeatureFlagsPage from '@/pages/admin/platform/FeatureFlagsPage'
import GlobalConfigPage from '@/pages/admin/platform/GlobalConfigPage'
import AdvancedManagementPage from '@/pages/admin/platform/AdvancedManagementPage'

import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ActivatePage from '@/pages/auth/ActivatePage'
import ResendActivationPage from '@/pages/auth/ResendActivationPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'

import HomePage from '@/pages/marketplace/HomePage'
import CategoriesPage from '@/pages/marketplace/CategoriesPage'
import CategoryBrowsePage from '@/pages/marketplace/CategoryBrowsePage'
import ShopsPage from '@/pages/marketplace/ShopsPage'
import ShopDetailPage from '@/pages/marketplace/ShopDetailPage'
import ProductDetailPage from '@/pages/marketplace/ProductDetailPage'
import SearchPage from '@/pages/marketplace/SearchPage'

import CartPage from '@/pages/checkout/CartPage'
import DeliveryPage from '@/pages/checkout/DeliveryPage'
import PaymentPage from '@/pages/checkout/PaymentPage'
import OrderSuccessPage from '@/pages/checkout/OrderSuccessPage'

import ProfileSetupPage from '@/pages/buyer/ProfileSetupPage'
import AccountPage from '@/pages/buyer/AccountPage'
import EditProfilePage from '@/pages/buyer/EditProfilePage'
import OrdersPage from '@/pages/buyer/OrdersPage'
import OrderDetailPage from '@/pages/buyer/OrderDetailPage'
import TrackOrderPage from '@/pages/buyer/TrackOrderPage'
import PointsPage from '@/pages/buyer/PointsPage'
import PointsHistoryPage from '@/pages/buyer/PointsHistoryPage'
import MyReviewsPage from '@/pages/buyer/MyReviewsPage'
import ReviewPage from '@/pages/buyer/ReviewPage'
import FavoritesPage from '@/pages/buyer/FavoritesPage'
import NotificationsPage from '@/pages/buyer/NotificationsPage'
import PendingPurchasesPage from '@/pages/buyer/PendingPurchasesPage'

import { SellerLayout } from '@/components/seller/SellerLayout'
import { SellerPublicLayout } from '@/components/seller/SellerPublicLayout'
import SellerRegisterPage from '@/pages/seller/auth/SellerRegisterPage'
import SellerLoginPage from '@/pages/seller/auth/SellerLoginPage'
import SellerActivatePage from '@/pages/seller/auth/SellerActivatePage'
import SellerPolicyPage from '@/pages/seller/auth/SellerPolicyPage'
import SellerResendActivationPage from '@/pages/seller/auth/SellerResendActivationPage'
import SellerOnboardingPage from '@/pages/seller/auth/SellerOnboardingPage'
import EmployeeLoginPage from '@/pages/seller/auth/EmployeeLoginPage'
import EmployeeInvitationAcceptPage from '@/pages/seller/auth/EmployeeInvitationAcceptPage'
import SellerDashboardPage from '@/pages/seller/dashboard/SellerDashboardPage'
import EmployeeDashboardPage from '@/pages/seller/dashboard/EmployeeDashboardPage'
import SellerBusinessPage from '@/pages/seller/business/SellerBusinessPage'
import SellerShopsPage from '@/pages/seller/shops/SellerShopsPage'
import SellerEmployeesPage from '@/pages/seller/employees/SellerEmployeesPage'
import SellerProductsPage from '@/pages/seller/products/SellerProductsPage'
import SelectShopPage from '@/pages/seller/products/SelectShopPage'
import ShopProductsPage from '@/pages/seller/products/ShopProductsPage'
import SellerProductCreatePage from '@/pages/seller/products/SellerProductCreatePage'
import SellerProductDetailPage from '@/pages/seller/products/SellerProductDetailPage'
import SellerStockPage from '@/pages/seller/stock/SellerStockPage'
import SellerOrdersPage from '@/pages/seller/orders/SellerOrdersPage'
import SellerCustomersPage from '@/pages/seller/customers/SellerCustomersPage'
import SellerCashPage from '@/pages/seller/cash/SellerCashPage'
import SellerGrowthPage from '@/pages/seller/growth/SellerGrowthPage'
import SellerReviewsPage from '@/pages/seller/reviews/SellerReviewsPage'
import SellerProfilePage from '@/pages/seller/profile/SellerProfilePage'

function NotFound() {
  const { t } = useI18n()
  return (
    <div className="empty-state" style={{ padding: '64px 0' }}>
      <div className="empty-icon">🧭</div>
      <h3>{t('notFound.title')}</h3>
      <Link to="/">
        <Button>{t('notFound.backToMarketplace')}</Button>
      </Link>
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
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/categories/:slug" element={<CategoryBrowsePage />} />
                <Route path="/shops" element={<ShopsPage />} />
                <Route path="/shops/:id" element={<ShopDetailPage />} />
                <Route path="/products/:id" element={<ProductDetailPage />} />
                <Route path="/search" element={<SearchPage />} />

                <Route path="/cart" element={<CartPage />} />
                <Route element={<RequireAuth />}>
                  <Route path="/checkout/delivery" element={<DeliveryPage />} />
                  <Route path="/checkout/payment" element={<PaymentPage />} />
                  <Route path="/orders/:orderId/success" element={<OrderSuccessPage />} />
                </Route>

                <Route element={<RequireBuyer />}>
                  <Route path="/account" element={<AccountPage />} />
                  <Route path="/account/edit" element={<EditProfilePage />} />
                  <Route path="/account/purchases" element={<PendingPurchasesPage />} />
                  <Route path="/account/profile-setup" element={<ProfileSetupPage />} />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/orders/:orderId" element={<OrderDetailPage />} />
                  <Route path="/orders/:orderId/tracking" element={<TrackOrderPage />} />
                  <Route path="/orders/:orderId/review" element={<ReviewPage />} />
                  <Route path="/points" element={<PointsPage />} />
                  <Route path="/points/history" element={<PointsHistoryPage />} />
                  <Route path="/reviews" element={<MyReviewsPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                </Route>

                <Route element={<PublicOnly />}>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/resend-activation" element={<ResendActivationPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                </Route>

                <Route path="/activate" element={<ActivatePage />} />
                <Route element={<RequireAuth />}>
                  <Route path="/favorites" element={<FavoritesPage />} />
                </Route>
              </Route>

              {/* Seller Routes */}
              <Route element={<SellerPublicLayout />}>
                <Route path="/seller" element={<SellerIndexRedirect />} />
                <Route element={<PublicOnly />}>
                  <Route path="/seller/register" element={<SellerRegisterPage />} />
                  <Route path="/seller/login" element={<SellerLoginPage />} />
                  <Route path="/seller/resend-activation" element={<SellerResendActivationPage />} />
                  <Route path="/employee/login" element={<EmployeeLoginPage />} />
                  <Route path="/employee/invite/accept" element={<EmployeeInvitationAcceptPage />} />
                </Route>
                <Route path="/seller/activate" element={<SellerActivatePage />} />
                <Route path="/activate-account" element={<SellerActivatePage />} />
                <Route path="/seller/politique" element={<SellerPolicyPage />} />
              </Route>

              <Route element={<SellerLayout />}>
                <Route element={<RequireSeller />}>
                  <Route path="/seller/onboarding" element={<SellerOnboardingPage />} />
                  <Route path="/seller/dashboard" element={<SellerDashboardPage />} />
                  <Route path="/seller/business" element={<SellerBusinessPage />} />
                  <Route path="/seller/shops" element={<SellerShopsPage />} />
                  <Route path="/seller/employees" element={<SellerEmployeesPage />} />
                  <Route path="/seller/products" element={<SellerProductsPage />} />
                  <Route path="/seller/products/select-shop" element={<SelectShopPage />} />
                  <Route path="/seller/shops/:shopId/products" element={<ShopProductsPage />} />
                  <Route path="/seller/shops/:shopId/products/new" element={<SellerProductCreatePage />} />
                  <Route path="/seller/products/new" element={<SelectShopPage />} />
                  <Route path="/seller/products/:productId" element={<SellerProductDetailPage />} />
                  <Route path="/seller/stock" element={<SellerStockPage />} />
                  <Route path="/seller/orders" element={<SellerOrdersPage />} />
                  <Route path="/seller/customers" element={<SellerCustomersPage />} />
                  <Route path="/seller/cash" element={<SellerCashPage />} />
                  <Route path="/seller/growth" element={<SellerGrowthPage />} />
                  <Route path="/seller/reviews" element={<SellerReviewsPage />} />
                  <Route path="/seller/profile" element={<SellerProfilePage />} />
                  <Route path="/seller/settings" element={<SellerProfilePage />} />
                </Route>

                <Route element={<RequireEmployee />}>
                  <Route path="/employee/dashboard" element={<EmployeeDashboardPage />} />
                </Route>
              </Route>

              {/* Admin Control Center Routes */}
              <Route element={<AdminPublicOnly />}>
                <Route path="/admin/login" element={<AdminLoginPage />} />
              </Route>
              <Route path="/admin/activate" element={<AdminActivatePage />} />

              <Route element={<RequireAdminAuth />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<Navigate to="/admin/direction" replace />} />
                  <Route element={<RequireAdminRole allowedRoles={['DIRECTION_ADMIN', 'SUPER_ADMIN']} />}>
                    <Route path="/admin/direction" element={<DirectionDashboardPage />} />
                  </Route>
                  <Route element={<RequireAdminRole allowedRoles={['SUPER_ADMIN']} />}>
                    <Route path="/admin/admin-users" element={<AdminUsersPage />} />
                    <Route path="/admin/users" element={<Navigate to="/admin/admin-users" replace />} />
                  </Route>
                  <Route element={<RequireAdminRole allowedRoles={['COMMERCE_ADMIN', 'SUPER_ADMIN']} />}>
                    <Route path="/admin/commerce" element={<CommerceDashboardPage />} />
                    <Route path="/admin/commerce/products" element={<CommerceProductsPage />} />
                    <Route path="/admin/commerce/products/:id" element={<CommerceProductDetailPage />} />
                    <Route path="/admin/commerce/categories" element={<CommerceCategoriesPage />} />
                    <Route path="/admin/commerce/inventory" element={<InventoryListPage />} />
                    <Route path="/admin/commerce/inventory/history" element={<StockHistoryPage />} />
                    <Route path="/admin/commerce/orders" element={<OrderListPage />} />
                    <Route path="/admin/commerce/orders/:id" element={<AdminOrderDetailPage />} />
                    <Route path="/admin/commerce/marketplace/visibility" element={<MarketplaceVisibilityPage />} />
                    <Route path="/admin/commerce/marketplace/ranking" element={<MarketplaceRankingPage />} />
                    <Route path="/admin/commerce/marketplace/search" element={<SearchAdminPage />} />
                    <Route path="/admin/commerce/marketplace/quality" element={<ProductQualityPage />} />
                    <Route path="/admin/commerce/marketplace/promotions" element={<PromotionVisibilityPage />} />
                    <Route path="/admin/commerce/employees" element={<EmployeeManagementPage />} />
                    <Route path="/admin/commerce/performance/sellers" element={<SellerPerformancePage />} />
                    <Route path="/admin/commerce/performance/categories" element={<CategoryPerformancePage />} />
                    <Route path="/admin/commerce/performance/shops" element={<ShopPerformancePage />} />
                  </Route>
                  <Route element={<RequireAdminRole allowedRoles={['FINANCE_SUPPORT_ADMIN', 'SUPER_ADMIN']} />}>
                    <Route path="/admin/finance" element={<FinanceDashboardPage />} />
                  </Route>
                  <Route element={<RequireAdminRole allowedRoles={['TECHNICAL_ADMIN', 'SUPER_ADMIN']} />}>
                    <Route path="/admin/technical" element={<TechnicalDashboardPage />} />
                  </Route>
                  <Route element={<RequireAdminRole allowedRoles={['SUPER_ADMIN', 'DIRECTION_ADMIN', 'COMMERCE_ADMIN', 'FINANCE_SUPPORT_ADMIN', 'TECHNICAL_ADMIN']} />}>
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
