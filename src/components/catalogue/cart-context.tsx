'use client';

// Public catalogue cart — client-only, persisted to localStorage. Holds the
// animals a direct customer wants to order; CartButton checks out the whole cart
// as one order + one Midtrans payment via createPublicOrder.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface CartItem {
  id: string;
  sku: string;
  title: string;
  price: number;
  photoUrl: string | null;
}

interface CartContextValue {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
  count: number;
  total: number;
  hydrated: boolean;
  // Master on/off from AppConfig — when false the cart UI stays hidden.
  paymentEnabled: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'mf-catalogue-cart';

export function CartProvider({ children, paymentEnabled }: { children: React.ReactNode; paymentEnabled: boolean }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Load once on mount (avoids SSR/client mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => (prev.some((p) => p.id === item.id) ? prev : [...prev, item]));
  }, []);
  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => ({
    items,
    add,
    remove,
    clear,
    has: (id: string) => items.some((p) => p.id === id),
    count: items.length,
    total: items.reduce((s, i) => s + i.price, 0),
    hydrated,
    paymentEnabled,
  }), [items, add, remove, clear, hydrated, paymentEnabled]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
