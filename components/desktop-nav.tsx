import { View, Text, Pressable, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';

/**
 * Desktop top navigation bar — only renders on web at 768px+.
 * Place at the top of each tab screen's root view on web.
 */
export function DesktopNav() {
  const { width } = useWindowDimensions();
  const colors = useColors();
  const router = useRouter();
  const pathname = usePathname();

  // Only show on web at desktop widths
  if (Platform.OS !== 'web' || width < 768) return null;

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  return (
    <View style={[styles.nav, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.inner}>
        {/* Brand */}
        <Pressable
          onPress={() => router.push('/')}
          style={({ pressed }) => [styles.brand, pressed && { opacity: 0.75 }]}
        >
          <IconSymbol name="trophy.fill" size={20} color={colors.accent} />
          <Text style={[styles.brandText, { color: colors.foreground }]}>Champion Cardboard Boats</Text>
        </Pressable>

        {/* Links */}
        <View style={styles.links}>
          {[
            { label: 'Packages', path: '/(tabs)/packages' },
            { label: 'My Downloads', path: '/(tabs)/downloads' },
            { label: 'Captain Bob', path: '/(tabs)/chat' },
          ].map(({ label, path }) => (
            <Pressable
              key={path}
              onPress={() => router.push(path as any)}
              style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}
            >
              <Text style={[
                styles.linkText,
                { color: isActive(path) ? colors.primary : colors.foreground },
                isActive(path) && styles.linkTextActive,
              ]}>
                {label}
              </Text>
              {isActive(path) && (
                <View style={[styles.activeIndicator, { backgroundColor: colors.primary }]} />
              )}
            </Pressable>
          ))}
          <Pressable
            onPress={() => router.push({ pathname: '/product/[tier]', params: { tier: 'premium' } })}
            style={({ pressed }) => [styles.cta, { backgroundColor: colors.accent }, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.ctaText}>Buy Now</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    borderBottomWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 32,
    zIndex: 100,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  link: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: 'relative',
  },
  linkText: {
    fontSize: 15,
    fontWeight: '500',
  },
  linkTextActive: {
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 14,
    right: 14,
    height: 2,
    borderRadius: 1,
  },
  cta: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 22,
    marginLeft: 8,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
