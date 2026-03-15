import { ScrollView, Text, View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { PRODUCTS, type Product } from '@/constants/products';

export default function PackagesScreen() {
  const colors = useColors();
  const router = useRouter();

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <Text style={styles.headerTitle}>Choose Your Package</Text>
          <Text style={styles.headerSubtitle}>
            Instant digital download after purchase
          </Text>
        </View>

        <View style={styles.content}>
          {/* Guarantee badge */}
          <View style={[styles.guaranteeBadge, { backgroundColor: colors.success + '18', borderColor: colors.success + '44' }]}>
            <IconSymbol name="checkmark.seal.fill" size={16} color={colors.success} />
            <Text style={[styles.guaranteeText, { color: colors.success }]}>
              30-Day Money-Back Guarantee
            </Text>
          </View>

          {/* Basic Package */}
          <PackageCard
            product={PRODUCTS.basic}
            accentColor={colors.primary}
            colors={colors}
            onPress={() => router.push({ pathname: '/product/[tier]', params: { tier: 'basic' } })}
          />

          {/* Premium Package */}
          <PackageCard
            product={PRODUCTS.premium}
            accentColor={colors.accent}
            colors={colors}
            isFeatured
            onPress={() => router.push({ pathname: '/product/[tier]', params: { tier: 'premium' } })}
          />

          {/* Comparison note */}
          <View style={[styles.comparisonNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="info.circle.fill" size={16} color={colors.muted} />
            <Text style={[styles.comparisonNoteText, { color: colors.muted }]}>
              All packages include lifetime access and free future updates to the plans.
            </Text>
          </View>
        </View>
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

      {/* Card Header */}
      <View style={[styles.cardHeader, { backgroundColor: accentColor + '12' }]}>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  content: {
    padding: 20,
    gap: 20,
  },
  guaranteeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  guaranteeText: {
    fontSize: 14,
    fontWeight: '600',
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
  comparisonNoteText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
});
