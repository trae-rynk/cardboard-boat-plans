/**
 * review-redirect.tsx
 *
 * Web-only landing page linked from the 5-day review email.
 * On mobile: tries to open the app via deep link (manus://write-review?...)
 * If the app is not installed or the deep link fails, shows a simple
 * in-page review form so the user can still leave a review.
 *
 * On native: Expo Router will redirect straight to /write-review with the
 * same params, so this page is effectively web-only.
 */
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Platform,
  Linking,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColors } from '@/hooks/use-colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ReviewRedirectScreen() {
  const { orderId, token, deepLink } = useLocalSearchParams<{
    orderId: string;
    token: string;
    deepLink?: string;
  }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<'trying' | 'fallback'>('trying');

  useEffect(() => {
    // On native, just navigate directly to the write-review screen
    if (Platform.OS !== 'web') {
      router.replace({
        pathname: '/write-review',
        params: { orderId, token },
      });
      return;
    }

    // On web: attempt the deep link, then show fallback after 2.5 seconds
    if (deepLink) {
      try {
        Linking.openURL(decodeURIComponent(deepLink));
      } catch {
        // ignore — fallback will show
      }
    }

    const timer = setTimeout(() => {
      setStatus('fallback');
    }, 2500);

    return () => clearTimeout(timer);
  }, [deepLink, orderId, token, router]);

  const handleOpenInBrowser = () => {
    router.push({
      pathname: '/write-review',
      params: { orderId, token },
    });
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      {status === 'trying' ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>
            Opening Cardboard Boat Builder…
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            If the app doesn't open automatically, tap the button below.
          </Text>
        </View>
      ) : (
        <View style={styles.centered}>
          {/* Logo / brand */}
          <View style={[styles.badge, { backgroundColor: colors.primary + '18' }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>
              Champion Cardboard Boats
            </Text>
          </View>

          <Text style={[styles.title, { color: colors.foreground }]}>
            How did your build go?
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            We'd love to hear about your experience. It only takes 30 seconds.
          </Text>

          {/* Primary CTA */}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleOpenInBrowser}
          >
            <Text style={[styles.buttonText, { color: '#ffffff' }]}>
              ⭐  Rate Your Experience
            </Text>
          </Pressable>

          {/* Deep link retry */}
          {deepLink ? (
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => Linking.openURL(decodeURIComponent(deepLink))}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.muted }]}>
                Open in the app instead
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 260,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
