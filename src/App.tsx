
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './router';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { CartProvider } from './contexts/CartContext';
import CartSidebar from './components/feature/CartSidebar';
import ScrollToTop from './components/system/ScrollToTop';

function App() {
  return (
    <div style={{ padding: 20 }}>
      <h1>App Component Loaded</h1>
      <p>If you see this, App.tsx is mounting correctly.</p>
      {/*
        <I18nextProvider i18n={i18n}>
        <CartProvider>
            <BrowserRouter>
            <ScrollToTop />
            <AppRoutes />
            <CartSidebar />
            </BrowserRouter>
        </CartProvider>
        </I18nextProvider>
        */}
    </div>
  );
}

export default App;
