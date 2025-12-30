
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './router';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { CartProvider } from './contexts/CartContext';
import CartSidebar from './components/feature/CartSidebar';
import ScrollToTop from './components/system/ScrollToTop';

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <CartProvider>
        <BrowserRouter basename={__BASE_PATH__}>
          <ScrollToTop />
          <AppRoutes />
          <CartSidebar />
        </BrowserRouter>
      </CartProvider>
    </I18nextProvider>
  );
}

export default App;
