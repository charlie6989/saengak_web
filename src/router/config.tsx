import { RouteObject } from 'react-router-dom';
import { lazy } from 'react';

// Lazy load components
const HomePage = lazy(() => import('../pages/home/page'));
const SearchPage = lazy(() => import('../pages/search/page'));
const ProductPage = lazy(() => import('../pages/product/page'));
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
const AdminPage = lazy(() => import('../pages/admin/page'));
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

import BestRated from '../pages/best-rated/page';

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
    path: '/product',
    element: <ProductPage />,
  },
  {
    path: '/product/:id',
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
    path: '/admin',
    element: <AdminPage />,
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
