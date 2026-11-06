import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const cart = vi.hoisted(() => ({ price: 680 }));

vi.mock('../src/contexts/CartContext', () => ({
  useCart: () => ({
    items: [{ id: 'gid://shopify/Product/1', name: '測試商品', price: cart.price, quantity: 1, image: '/a.webp' }],
    removeFromCart: () => undefined,
    updateQuantity: () => undefined,
    clearCart: () => undefined,
    getTotalPrice: () => cart.price,
    isCartOpen: true,
    setIsCartOpen: () => undefined,
    validateAndPruneCart: async () => undefined,
    prunedNotice: null,
    setPrunedNotice: () => undefined,
  }),
}));
vi.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, isLoading: false }),
}));

import CartSidebar from '../src/components/feature/CartSidebar';

function renderCart(price: number) {
  cart.price = price;
  return renderToStaticMarkup(
    <MemoryRouter>
      <CartSidebar />
    </MemoryRouter>,
  );
}

describe('cart estimated total', () => {
  it('adds the NT$146 estimated shipping below the free-shipping threshold', () => {
    const html = renderCart(680);
    expect(html).toContain('預估運費');
    expect(html).toMatch(/cart-estimated-shipping.*146/);
    expect(html).toContain('預估總計');
    expect(html).toMatch(/cart-estimated-total[^>]*>NT\$826/);
    expect(html).toContain('運費與最終金額以結帳頁為準');
    expect(html).not.toContain('總結帳金額');
  });

  it('shows free shipping at NT$1,500 and leaves it out of the total', () => {
    const html = renderCart(1500);
    expect(html).toMatch(/cart-estimated-shipping.*免運/);
    expect(html).toMatch(/cart-estimated-total[^>]*>NT\$1,500/);
    expect(html).toContain('已達成免運門檻');
  });
});
