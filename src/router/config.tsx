import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { lazy } from 'react';

// Lazy load components
const HomePage = lazy(() => import('../pages/home/page'));
const SearchPage = lazy(() => import('../pages/search/page'));
const ProductPage = lazy(() => import('../pages/product/page'));
const ProductPreviewPage = lazy(() => import('../pages/product-preview/page'));
const LoginPage = lazy(() => import('../pages/login/page'));
const RegisterPage = lazy(() => import('../pages/register/page'));
const ProfilePage = lazy(() => import('../pages/profile/page'));
const BlogPage = lazy(() => import('../pages/blog/page'));
const CommunityPage = lazy(() => import('../pages/community/page'));
const AboutPage = lazy(() => import('../pages/about/page'));
const BrandStoryPage = lazy(() => import('../pages/brand-story/page'));
const PromotionPage = lazy(() => import('../pages/promotion/page'));
const WelcomePage = lazy(() => import('../pages/welcome/page'));
const ForgotPasswordPage = lazy(() => import('../pages/forgot-password/page'));
const ResetPasswordPage = lazy(() => import('../pages/reset-password/page'));
const AuthConfirmPage = lazy(() => import('../pages/auth/confirm/page'));
// Checkout routes have been deprecated and moved to Shopify Checkout
const AdminGuard = lazy(() => import('./AdminGuard'));
const AdminLayoutPage = lazy(() => import('../pages/admin/AdminLayout'));
const AdminDashboardPage = lazy(() => import('../pages/admin/Dashboard'));
const AdminProductListPage = lazy(() => import('../pages/admin/ProductList'));
const AdminOrderListPage = lazy(() => import('../pages/admin/OrderList'));
const AdminReviewsPage = lazy(() => import('../pages/admin/AdminReviews'));
const AdminQAPage = lazy(() => import('../pages/admin/AdminQA'));
const AdminMembersPage = lazy(() => import('../pages/admin/AdminMembers'));
const AdminStaffPage = lazy(() => import('../pages/admin/AdminStaff'));
const AdminModulesPage = lazy(() => import('../pages/admin/page'));
const SiteSettingsPage = lazy(() => import('../pages/admin/SiteSettings'));
const OrderStatusPage = lazy(() => import('../pages/order-status/page'));
const CustomerServicePage = lazy(() => import('../pages/customer-service/page'));
const FAQPage = lazy(() => import('../pages/faq/page'));
const ReturnPolicyPage = lazy(() => import('../pages/return-policy/page'));
const PrivacyPage = lazy(() => import('../pages/privacy/page'));
const TermsPage = lazy(() => import('../pages/terms/page'));
const TermsOfServicePage = lazy(() => import('../pages/terms-of-service/page'));
const AdChoicesPage = lazy(() => import('../pages/adchoices/page'));
const SitemapPage = lazy(() => import('../pages/sitemap/page'));
const NotFoundPage = lazy(() => import('../pages/NotFound'));
const BestRated = lazy(() => import('../pages/best-rated/page'));

const routes: RouteObject[] = [
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/search',
    element: <SearchPage />,
  },
  {
    path: '/products',
    element: <SearchPage />,
  },
  {
    path: '/product',
    element: <ProductPage />,
  },
  {
    path: '/product-preview',
    element: <ProductPreviewPage />,
  },
  {
    path: '/product/:id',
    element: <ProductPage />,
  },
  {
    path: '/product/*',
    element: <ProductPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/profile',
    element: <ProfilePage />,
  },
  {
    path: '/blog',
    element: <BlogPage />,
  },
  {
    path: '/blog/:handle',
    element: <BlogPage />,
  },
  {
    path: '/community',
    element: <CommunityPage />,
  },
  {
    path: '/about',
    element: <AboutPage />,
  },
  {
    path: '/brand-story',
    element: <BrandStoryPage />,
  },
  {
    path: '/promotion',
    element: <PromotionPage />,
  },
  {
    path: '/welcome',
    element: <WelcomePage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: '/auth/confirm',
    element: <AuthConfirmPage />,
  },
  {
    path: '/auth/callback',
    element: <AuthConfirmPage />,
  },
  {
    path: '/auth/v1/callback',
    element: <AuthConfirmPage />,
  },

  {
    path: '/admin',
    element: <AdminGuard />,
    children: [
      {
        element: <AdminLayoutPage />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <AdminDashboardPage /> },
          { path: 'products', element: <AdminProductListPage /> },
          { path: 'orders', element: <AdminOrderListPage /> },
          { path: 'reviews', element: <AdminReviewsPage /> },
          { path: 'qa', element: <AdminQAPage /> },
          { path: 'members', element: <AdminMembersPage /> },
          { path: 'admins', element: <AdminStaffPage /> },
          { path: 'settings', element: <SiteSettingsPage /> },
          { path: 'modules', element: <AdminModulesPage /> },
        ],
      },
    ],
  },
  {
    path: '/order-status',
    element: <OrderStatusPage />,
  },
  {
    path: '/customer-service',
    element: <CustomerServicePage />,
  },
  {
    path: '/faq',
    element: <FAQPage />,
  },
  {
    path: '/return-policy',
    element: <ReturnPolicyPage />,
  },
  {
    path: '/privacy',
    element: <PrivacyPage />,
  },
  {
    path: '/terms',
    element: <TermsPage />,
  },
  {
    path: '/terms-of-service',
    element: <TermsOfServicePage />,
  },
  {
    path: '/adchoices',
    element: <AdChoicesPage />,
  },
  {
    path: '/sitemap',
    element: <SitemapPage />,
  },
  {
    path: '/best-rated',
    element: <BestRated />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];

export default routes;
