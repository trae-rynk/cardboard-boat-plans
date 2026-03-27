import { ScrollView, Text, View, Pressable, StyleSheet, Image, useWindowDimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { PRODUCTS, type Product } from '@/constants/products';

export default function PackagesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Desktop top nav spacer */}
        {isDesktop && <View style={{ height: 16 }} />}

        {/* Header */}
        <View style={[styles.header, isDesktop && styles.headerDesktop]}>
          <Text style={[styles.headerTitle, { color: '#1a3a5c' }, isDesktop && styles.headerTitleDesktop]}>
            Choose Your Package
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.muted }, isDesktop && styles.headerSubtitleDesktop]}>
            Instant digital download after purchase — no shipping, no waiting.
          </Text>
        </View>

        {/* Cards */}
        <View style={[styles.content, isDesktop && styles.contentDesktop]}>
          {isDesktop ? (
            /* Desktop: side-by-side cards */
            <View style={styles.desktopRow}>
              <View style={styles.desktopCardWrapper}>
                <PackageCard
                  product={PRODUCTS.basic}
                  accentColor={colors.primary}
                  colors={colors}
                  onPress={() => router.push({ pathname: '/product/[tier]', params: { tier: 'basic' } })}
                />
              </View>
              <View style={styles.desktopCardWrapper}>
                <PackageCard
                  product={PRODUCTS.premium}
                  accentColor={colors.accent}
                  colors={colors}
                  isFeatured
                  onPress={() => router.push({ pathname: '/product/[tier]', params: { tier: 'premium' } })}
                />
              </View>
            </View>
          ) : (
            /* Mobile: stacked cards */
            <>
              <PackageCard
                product={PRODUCTS.basic}
                accentColor={colors.primary}
                colors={colors}
                onPress={() => router.push({ pathname: '/product/[tier]', params: { tier: 'basic' } })}
              />
              <PackageCard
                product={PRODUCTS.premium}
                accentColor={colors.accent}
                colors={colors}
                isFeatured
                onPress={() => router.push({ pathname: '/product/[tier]', params: { tier: 'premium' } })}
              />
            </>
          )}

          {/* Comparison note */}
          <View style={[styles.comparisonNote, { backgroundColor: colors.surface, borderColor: colors.border }, isDesktop && styles.comparisonNoteDesktop]}>
            <IconSymbol name="info.circle.fill" size={16} color={colors.muted} />
            <Text style={[styles.comparisonNoteText, { color: colors.muted }]}>
              All packages include lifetime access and free future updates to the plans.
            </Text>
          </View>
        </View>

        {/* Desktop trust strip */}
        {isDesktop && (
          <View style={[styles.trustStrip, { borderTopColor: colors.border }]}>
            {[
              { icon: '🔒', label: 'Secure Checkout', sub: 'Powered by Stripe' },
              { icon: '⚡', label: 'Instant Download', sub: 'Delivered by email' },
              { icon: '♾️', label: 'Lifetime Access', sub: 'Free future updates' },
              { icon: '🏆', label: 'Proven Plans', sub: 'Win-tested designs' },
            ].map((item) => (
              <View key={item.label} style={styles.trustItem}>
                <Text style={styles.trustIcon}>{item.icon}</Text>
                <Text style={[styles.trustLabel, { color: '#1a3a5c' }]}>{item.label}</Text>
                <Text style={[styles.trustSub, { color: colors.muted }]}>{item.sub}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

interface PackageCardProps {
  product: Product;
  accentColor: string;
  colors: ReturnType<typeof useColors>;
  isFeatured?: boolean;
  onPress: () => void;
}

function PackageCard({ product, accentColor, colors, isFeatured, onPress }: PackageCardProps) {
  return (
    <View
      style={[
        styles.packageCard,
        {
          backgroundColor: colors.surface,
          borderColor: isFeatured ? accentColor : colors.border,
          borderWidth: isFeatured ? 2 : 1,
        },
      ]}
    >
      {isFeatured && product.badge && (
        <View style={[styles.featuredBadge, { backgroundColor: accentColor }]}>
          <Text style={styles.featuredBadgeText}>⭐ {product.badge}</Text>
        </View>
      )}

      {/* Hero image (Premium only) */}
      {product.heroImage && (
        <Image
          source={product.heroImage}
          style={styles.heroImage}
          resizeMode="cover"
        />
      )}

      {/* Card Header */}
      <View style={[styles.cardHeader, { backgroundColor: product.heroImage ? 'transparent' : accentColor + '12' }]}>
        <Text style={[styles.packageName, { color: colors.foreground }]}>{product.name}</Text>
        <Text style={[styles.packageTagline, { color: colors.muted }]}>{product.tagline}</Text>
        <Text style={[styles.packagePrice, { color: accentColor }]}>{product.priceDisplay}</Text>
      </View>

      {/* Features */}
      <View style={styles.featureList}>
        {product.features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <IconSymbol
              name={feature.included ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
              size={18}
              color={feature.included ? colors.success : colors.border}
            />
            <Text
              style={[
                styles.featureText,
                { color: feature.included ? colors.foreground : colors.muted },
                !feature.included && styles.featureTextDisabled,
              ]}
            >
              {feature.text}
            </Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <Pressable
        style={({ pressed }) => [
          styles.ctaButton,
          { backgroundColor: accentColor },
          pressed && { opacity: 0.85 },
        ]}
        onPress={onPress}
      >
        <IconSymbol name="cart.fill" size={18} color="#FFFFFF" />
        <Text style={styles.ctaButtonText}>
          Get {product.id === 'basic' ? 'Basic' : 'Premium'} — {product.priceDisplay}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
  },
  headerDesktop: {
    paddingTop: 40,
    paddingBottom: 32,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerTitleDesktop: {
    fontSize: 36,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  headerSubtitleDesktop: {
    fontSize: 16,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  contentDesktop: {
    paddingHorizontal: 40,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  desktopRow: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'flex-start',
  },
  desktopCardWrapper: {
    flex: 1,
  },
  packageCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  featuredBadge: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  featuredBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardHeader: {
    padding: 20,
    gap: 4,
  },
  packageName: {
    fontSize: 20,
    fontWeight: '800',
  },
  packageTagline: {
    fontSize: 14,
    lineHeight: 20,
  },
  packagePrice: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: 8,
  },
  featureList: {
    padding: 16,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  featureTextDisabled: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  ctaButton: {
    margin: 16,
    marginTop: 4,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  comparisonNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  comparisonNoteDesktop: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  comparisonNoteText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  heroImage: {
    width: '100%',
    height: 180,
  },
  trustStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 0,
    paddingVertical: 32,
    paddingHorizontal: 40,
    borderTopWidth: 1,
    marginTop: 16,
  },
  trustItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    maxWidth: 200,
  },
  trustIcon: {
    fontSize: 28,
  },
  trustLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  trustSub: {
    fontSize: 12,
    textAlign: 'center',
  },
});
