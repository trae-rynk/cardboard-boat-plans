import { ScrollView, Text, View, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ScreenContainer } from '@/components/screen-container';
import { ImagePlaceholder } from '@/components/image-placeholder';

import { VideoPlaceholder } from '@/components/video-placeholder';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { PRODUCTS, type ProductTier } from '@/constants/products';
import { ReviewsSection } from '@/components/reviews-list';
import { StarRatingDisplay } from '@/components/star-rating';
import { trpc } from '@/lib/trpc';

const HERO_IMAGE = require('@/assets/images/hero1.jpg');
const BOAT1_IMAGE = require('@/assets/images/cover2a.jpg');
const WIP_IMAGE = { uri: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663440726246/3jSuK5LFpDyoiJhrkZmbR9/wip_92e8a8c4.png' };
const MANUS1_IMAGE = require('@/assets/images/manus1.webp');
const RACEDAY_IMAGE = require('@/assets/images/raceday.jpg');
const WINNER1_IMAGE = require('@/assets/images/winner1.jpg');
const RACE2_IMAGE = { uri: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663440726246/3jSuK5LFpDyoiJhrkZmbR9/race2_ef031f43.jpg' };

export default function ProductDetailScreen() {
  const { tier } = useLocalSearchParams<{ tier: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const product = PRODUCTS[(tier as ProductTier) ?? 'basic'];
  const accentColor = tier === 'premium' ? colors.accent : colors.primary;

  const { data: ratingStats } = trpc.reviews.stats.useQuery(
    { productTier: (tier as ProductTier) ?? 'basic' },
  );

  if (!product) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text style={{ color: colors.muted }}>Product not found</Text>
      </ScreenContainer>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Back button overlay */}
      <Pressable
        style={[styles.backButton, { top: insets.top + 12, backgroundColor: colors.surface + 'EE' }]}
        onPress={() => router.back()}
      >
        <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
      </Pressable>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Hero Image — use product-specific image if available, else default */}
        <Image
          source={product.heroImage ?? HERO_IMAGE}
          style={{ width: '100%', height: 260 }}
          contentFit="cover"
          transition={300}
          accessibilityLabel={product.name}
        />

        {/* Product Header */}
        <View style={[styles.productHeader, { backgroundColor: colors.surface }]}>
          {product.badge && (
            <View style={[styles.badge, { backgroundColor: accentColor }]}>
              <Text style={styles.badgeText}>⭐ {product.badge}</Text>
            </View>
          )}
          <Text style={[styles.productName, { color: colors.foreground }]}>{product.name}</Text>
          <Text style={[styles.productPrice, { color: accentColor }]}>{product.priceDisplay}</Text>
          {ratingStats && ratingStats.totalReviews > 0 && (
            <StarRatingDisplay
              rating={ratingStats.averageRating}
              size={15}
              showNumber
              reviewCount={ratingStats.totalReviews}
            />
          )}
          <Text style={[styles.productDescription, { color: colors.muted }]}>
            {product.description}
          </Text>
        </View>

        {/* What's Included */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#1a3a5c' }]}>What's Included</Text>
          <View style={[styles.featureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {product.features
              .filter((f) => f.included)
              .map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <IconSymbol name="checkmark.circle.fill" size={18} color={colors.success} />
                  <Text style={[styles.featureText, { color: colors.foreground }]}>
                    {feature.text}
                  </Text>
                </View>
              ))}
          </View>
        </View>

        {/* Photo Gallery */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#1a3a5c' }]}>Gallery</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
            {/* First gallery slot — boat plans construction photo */}
            <Image
              source={BOAT1_IMAGE}
              style={{ width: 160, height: 120, borderRadius: 10, marginRight: 12 }}
              contentFit="cover"
              transition={200}
              accessibilityLabel="Cardboard boat construction"
            />
            {/* Gallery slot 2 — build in progress */}
            <Image
              source={WIP_IMAGE}
              style={{ width: 160, height: 120, borderRadius: 10, marginRight: 12 }}
              contentFit="cover"
              transition={200}
              accessibilityLabel="Building the boat in progress"
            />
            {/* Gallery slot 3 — finished red boat */}
            <Image
              source={MANUS1_IMAGE}
              style={{ width: 160, height: 120, borderRadius: 10, marginRight: 12 }}
              contentFit="cover"
              transition={200}
              accessibilityLabel="Finished red cardboard boat with paddle"
            />
            {/* Gallery slot 4 — race day crowd shot */}
            <Image
              source={RACE2_IMAGE}
              style={{ width: 160, height: 120, borderRadius: 10, marginRight: 12 }}
              contentFit="cover"
              transition={200}
              accessibilityLabel="Kids racing cardboard boats on the water"
            />
          </ScrollView>
        </View>

        {/* Video Preview (Premium only) */}
        {tier === 'premium' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: '#1a3a5c' }]}>
              Video Tutorial Preview
            </Text>
            <VideoPlaceholder
              height={200}
              label="Add Video Tutorial Preview"
            />
            <Text style={[styles.videoNote, { color: colors.muted }]}>
              Full video series (6 videos) unlocked after purchase
            </Text>
          </View>
        )}

        {/* Additional Images */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#1a3a5c' }]}>Build Examples</Text>
          <Image
            source={WINNER1_IMAGE}
            style={{ width: '100%', height: 180, borderRadius: 12 }}
            contentFit="cover"
            transition={200}
            accessibilityLabel="Winner boat racing on the water"
          />
          <View style={{ height: 12 }} />
          <Image
            source={RACEDAY_IMAGE}
            style={{ width: '100%', height: 180, borderRadius: 12 }}
            contentFit="cover"
            transition={200}
            accessibilityLabel="Race day action photo"
          />
        </View>

        {/* Reviews Section */}
        <View style={[styles.section, { paddingBottom: 8 }]}>
          <ReviewsSection
            productTier={(tier as ProductTier) ?? 'basic'}
            accentColor={accentColor}
          />
        </View>

      </ScrollView>

      {/* Sticky Bottom CTA */}
      <View
        style={[
          styles.stickyBottom,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <View style={styles.stickyPriceRow}>
          <View>
            <Text style={[styles.stickyLabel, { color: colors.muted }]}>One-time purchase</Text>
            <Text style={[styles.stickyPrice, { color: accentColor }]}>{product.priceDisplay}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.buyButton,
              { backgroundColor: accentColor },
              pressed && { opacity: 0.85 },
            ]}
            onPress={() =>
              router.push({ pathname: '/checkout', params: { tier: product.id } } as any)
            }
          >
            <IconSymbol name="lock.fill" size={16} color="#FFFFFF" />
            <Text style={styles.buyButtonText}>Buy Now</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  productHeader: {
    padding: 20,
    gap: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  productName: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
  },
  productPrice: {
    fontSize: 28,
    fontWeight: '800',
  },
  productDescription: {
    fontSize: 15,
    lineHeight: 23,
    marginTop: 4,
  },
  section: {
    padding: 20,
    paddingTop: 0,
    marginTop: 20,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  featureCard: {
    borderRadius: 12,
    borderWidth: 1,
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
  galleryScroll: {
    marginLeft: -4,
  },
  videoNote: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  stickyBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  stickyPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stickyLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  stickyPrice: {
    fontSize: 24,
    fontWeight: '800',
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
