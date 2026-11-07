import { Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './router';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import CartSidebar from './components/feature/CartSidebar';
import ScrollToTop from './components/system/ScrollToTop';
import ErrorBoundary from './components/system/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <CartProvider>
            <BrowserRouter>
              <ScrollToTop />
              <ErrorBoundary>
                {/* 頁面程式載入中：顯示與頁面同色的空白畫面，不閃出英文 Loading 字樣，也避免版面跳動 */}
                <Suspense fallback={<div className="min-h-screen bg-[#F7F6F3]" aria-busy="true" aria-label="頁面載入中" />}>
                  <AppRoutes />
                </Suspense>
              </ErrorBoundary>
              <CartSidebar />
            </BrowserRouter>
          </CartProvider>
        </AuthProvider>
      </I18nextProvider>
    </ErrorBoundary>
  );
}

export default App;
