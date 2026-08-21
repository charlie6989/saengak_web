
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { clampCartQuantity, getCartLineKey } from '../domain/algorithms';

export interface CartItem {
  id: string;
  variantId?: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  originalPrice?: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: any, quantity?: number) => void;
  removeFromCart: (lineKey: string) => void;
  updateQuantity: (lineKey: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function normalizeId(id: unknown): string {
  if (!id) return '';
  const str = String(id).trim();
  if (str.startsWith('gid://shopify/Product/')) {
    return str.replace('gid://shopify/Product/', '');
  }
  if (str.startsWith('gid://shopify/ProductVariant/')) {
    return str.replace('gid://shopify/ProductVariant/', '');
  }
  return str;
}

/**
 * 智慧去重與合併購物車項目
 * 若同款商品（名稱相同或 ID 相同），自動合併並將 variantId 升級為有效值，數量累加
 */
function consolidateCartItems(rawItems: CartItem[]): CartItem[] {
  const consolidated: CartItem[] = [];

  for (const raw of rawItems) {
    const rawNormId = normalizeId(raw.id);
    const existingIndex = consolidated.findIndex((item) => {
      // 1. 若兩者具有相同且非空的 variantId
      if (raw.variantId && item.variantId && raw.variantId === item.variantId) {
        return true;
      }
      // 2. 若 normalized ID 相同或商品名稱完全一致
      const itemNormId = normalizeId(item.id);
      const isSameId = rawNormId && itemNormId && rawNormId === itemNormId;
      const isSameName = raw.name && item.name && raw.name.trim() === item.name.trim();

      if (isSameId || isSameName) {
        // 若任一方無指定特定子規格，或兩者規格相同，則視為同款商品合併
        return !raw.variantId || !item.variantId || raw.variantId === item.variantId;
      }
      return false;
    });

    if (existingIndex >= 0) {
      const existing = consolidated[existingIndex];
      consolidated[existingIndex] = {
        ...existing,
        // 優先保留有效的 variantId
        variantId: existing.variantId || raw.variantId,
        quantity: clampCartQuantity(existing.quantity + (raw.quantity || 1)),
        price: existing.price || raw.price,
        image: existing.image || raw.image,
      };
    } else {
      consolidated.push({
        ...raw,
        quantity: clampCartQuantity(raw.quantity || 1),
      });
    }
  }

  return consolidated;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [hasHydratedCart, setHasHydratedCart] = useState(false);

  // Load cart from localStorage on mount and automatically deduplicate
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) {
          setItems(consolidateCartItems(parsed));
        }
      } catch (error) {
        console.error('Error loading cart from localStorage:', error);
      }
    }
    setHasHydratedCart(true);
  }, []);

  // Save cart to localStorage whenever items change
  useEffect(() => {
    if (hasHydratedCart) {
      localStorage.setItem('cart', JSON.stringify(items));
    }
  }, [hasHydratedCart, items]);

  const addToCart = (product: any, quantity: number = 1) => {
    const safeQuantity = clampCartQuantity(quantity);
    const purchasableVariantIds = Array.isArray(product.variants)
      ? product.variants
        .filter((variant: any) => variant?.availableForSale !== false)
        .map((variant: any) => variant?.id)
        .filter((variantId: unknown): variantId is string => typeof variantId === 'string')
      : [];
    const variantId = typeof product.variantId === 'string'
      ? product.variantId
      : purchasableVariantIds.length === 1
        ? purchasableVariantIds[0]
        : (product.variants?.[0]?.id || undefined);
    const productId = String(product.id || '');
    const productName = String(product.name || product.title || '商品');

    const newItem: CartItem = {
      id: productId,
      variantId,
      name: productName,
      price: typeof product.price === 'number' ? product.price : parseFloat(product.price || '0'),
      image: product.image || product.images?.[0]?.url || '',
      quantity: safeQuantity,
      originalPrice: product.originalPrice,
    };

    setItems((prevItems) => consolidateCartItems([...prevItems, newItem]));
  };

  const removeFromCart = (lineKey: string) => {
    setItems(prevItems => prevItems.filter(item => getCartLineKey(item) !== lineKey));
  };

  const updateQuantity = (lineKey: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(lineKey);
      return;
    }
    
    setItems(prevItems =>
      prevItems.map(item =>
        getCartLineKey(item) === lineKey ? { ...item, quantity: clampCartQuantity(quantity) } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const getTotalItems = () => {
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getTotalItems,
      getTotalPrice,
      isCartOpen,
      setIsCartOpen
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
