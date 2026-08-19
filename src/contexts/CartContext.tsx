
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

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [hasHydratedCart, setHasHydratedCart] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
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
        : undefined;
    const productId = String(product.id);

    setItems(prevItems => {
      const existingItem = prevItems.find(
        item => item.id === productId && item.variantId === variantId,
      );
      
      if (existingItem) {
        return prevItems.map(item =>
          item.id === productId && item.variantId === variantId
            ? { ...item, quantity: clampCartQuantity(item.quantity + safeQuantity) }
            : item
        );
      } else {
        return [...prevItems, {
          id: productId,
          variantId,
          name: product.name,
          price: product.price,
          image: product.image,
          quantity: safeQuantity,
          originalPrice: product.originalPrice
        }];
      }
    });
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
