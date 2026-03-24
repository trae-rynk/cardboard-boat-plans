/**
 * Chat Store — persists the Premium customer's orderId and chatToken
 * so Captain Bob is accessible across app sessions without sign-in.
 *
 * The chatToken is generated at purchase confirmation and stored locally.
 * It acts as the authentication credential for all chat API calls.
 */
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'captain_bob_credentials';

interface ChatCredentials {
  orderId: number;
  chatToken: string;
}

let _cached: ChatCredentials | null = null;
const _listeners: Array<() => void> = [];

function notify() {
  _listeners.forEach((fn) => fn());
}

/** Save credentials after a Premium purchase */
export async function saveChatCredentials(orderId: number, chatToken: string) {
  _cached = { orderId, chatToken };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_cached));
  notify();
}

/** Load credentials from storage (called on app start) */
export async function loadChatCredentials(): Promise<ChatCredentials | null> {
  if (_cached) return _cached;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      _cached = JSON.parse(raw) as ChatCredentials;
      return _cached;
    }
  } catch {
    // ignore
  }
  return null;
}

/** Clear credentials (e.g. for testing) */
export async function clearChatCredentials() {
  _cached = null;
  await AsyncStorage.removeItem(STORAGE_KEY);
  notify();
}

/** React hook — returns current credentials and re-renders on change */
export function useChatStore() {
  const [creds, setCreds] = useState<ChatCredentials | null>(_cached);

  useEffect(() => {
    // Load from storage on mount if not already cached
    if (!_cached) {
      loadChatCredentials().then((c) => {
        if (c) setCreds(c);
      });
    }

    const listener = () => {
      setCreds(_cached ? { ..._cached } : null);
    };
    _listeners.push(listener);
    return () => {
      const idx = _listeners.indexOf(listener);
      if (idx >= 0) _listeners.splice(idx, 1);
    };
  }, []);

  return {
    orderId: creds?.orderId ?? null,
    chatToken: creds?.chatToken ?? null,
    hasAccess: !!creds,
  };
}
