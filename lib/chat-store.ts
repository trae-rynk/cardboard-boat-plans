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
// Track whether we've completed the initial AsyncStorage load
let _loaded = false;
const _listeners: Array<() => void> = [];

function notify() {
  _listeners.forEach((fn) => fn());
}

/** Save credentials after a Premium purchase */
export async function saveChatCredentials(orderId: number, chatToken: string) {
  _cached = { orderId, chatToken };
  _loaded = true;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_cached));
  notify();
}

/** Load credentials from storage (called on app start) */
export async function loadChatCredentials(): Promise<ChatCredentials | null> {
  if (_loaded) return _cached;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      _cached = JSON.parse(raw) as ChatCredentials;
    }
  } catch {
    // ignore
  }
  _loaded = true;
  return _cached;
}

/** Clear credentials (e.g. for testing) */
export async function clearChatCredentials() {
  _cached = null;
  _loaded = true;
  await AsyncStorage.removeItem(STORAGE_KEY);
  notify();
}

/** React hook — returns current credentials and re-renders on change.
 *  `isLoading` is true until the initial AsyncStorage read completes,
 *  preventing a flash of the "Premium only" gate while credentials load. */
export function useChatStore() {
  const [creds, setCreds] = useState<ChatCredentials | null>(_cached);
  const [isLoading, setIsLoading] = useState(!_loaded);

  useEffect(() => {
    if (!_loaded) {
      loadChatCredentials().then((c) => {
        setCreds(c);
        setIsLoading(false);
      });
    } else {
      // Already loaded (e.g. saveChatCredentials was called before mount)
      setCreds(_cached);
      setIsLoading(false);
    }

    const listener = () => {
      setCreds(_cached ? { ..._cached } : null);
      setIsLoading(false);
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
    isLoading,
  };
}
