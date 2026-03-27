/**
 * Order Store — persists the most recent orderId locally so the Downloads tab
 * can show files for guest customers without requiring sign-in.
 *
 * Stores up to 5 recent order IDs so customers who buy both packages can see all their files.
 */
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'recent_order_ids';
const MAX_ORDERS = 5;

let _cached: number[] | null = null;
const _listeners: Array<() => void> = [];

function notify() {
  _listeners.forEach((fn) => fn());
}

/** Save a new orderId (prepends to list, deduplicates, caps at MAX_ORDERS) */
export async function saveOrderId(orderId: number) {
  const existing = await loadOrderIds();
  const updated = [orderId, ...existing.filter((id) => id !== orderId)].slice(0, MAX_ORDERS);
  _cached = updated;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  notify();
}

/** Load all saved order IDs */
export async function loadOrderIds(): Promise<number[]> {
  if (_cached !== null) return _cached;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      _cached = JSON.parse(raw) as number[];
      return _cached;
    }
  } catch {
    // ignore
  }
  _cached = [];
  return _cached;
}

/** React hook — returns current order IDs and re-renders on change */
export function useOrderStore() {
  const [orderIds, setOrderIds] = useState<number[]>(_cached ?? []);

  useEffect(() => {
    if (_cached === null) {
      loadOrderIds().then((ids) => setOrderIds(ids));
    }

    const listener = () => {
      setOrderIds(_cached ? [..._cached] : []);
    };
    _listeners.push(listener);
    return () => {
      const idx = _listeners.indexOf(listener);
      if (idx >= 0) _listeners.splice(idx, 1);
    };
  }, []);

  return { orderIds };
}
