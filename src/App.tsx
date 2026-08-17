import { Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './router';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { CartProvider } from './contexts/CartContext';
import CartSidebar from './components/feature/CartSidebar';
import ScrollToTop from './components/system/ScrollToTop';
import ErrorBoundary from './components/system/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <CartProvider>
          <BrowserRouter>
            <ScrollToTop />
            <ErrorBoundary>
              <Suspense fallback={<div style={{ padding: 20, fontSize: 24 }}>Loading...</div>}>
                <AppRoutes />
              </Suspense>
            </ErrorBoundary>
            <CartSidebar />
          </BrowserRouter>
        </CartProvider>
      </I18nextProvider>
    </ErrorBoundary>
  );
}

export default App;
