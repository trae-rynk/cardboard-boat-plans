import { ScrollView, Text, View, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ScreenContainer } from '@/components/screen-container';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { PRODUCTS, TESTIMONIALS } from '@/constants/products';

const HERO_IMAGE = require('@/assets/images/hero1.jpg');
const BASIC_PLANS_IMAGE = require('@/assets/images/cover2a.jpg');
const UPGRADE_IMAGE = require('@/assets/images/upgrade-premium.jpg');

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();

  const insets = useSafeAreaInsets();

  return (
    // Use edges={[]} so the hero image can bleed under the status bar
    <ScreenContainer edges={[]} containerClassName="bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Hero Image — full-bleed, full photo visible, no crop */}
        {/* Image is 1232×684 → aspect ratio 684/1232 ≈ 0.555 */}
        <View style={[styles.heroContainer, { paddingTop: insets.top }]}>
          <Image
            source={HERO_IMAGE}
            style={styles.heroImage}
            contentFit="contain"
            transition={300}
            accessibilityLabel="Eight-time champion cardboard boat racer"
          />
        </View>

        {/* Tagline Section */}
        <View style={[styles.taglineSection, { backgroundColor: colors.surface }]}>
          <View style={[styles.badge, { backgroundColor: colors.accent + '22' }]}>
            <IconSymbol name="trophy.fill" size={14} color={colors.accent} />
            <Text style={[styles.badgeText, { color: colors.accent }]}>
              Competition-Tested Plan
            </Text>
          </View>
          <Text style={[styles.taglineHeading, { color: colors.foreground }]}>
            Build an Award-Winning{'\n'}Cardboard Boat
          </Text>
          <Text style={[styles.taglineBody, { color: colors.muted }]}>
            Most boats sink and fail. Let us help you build a boat that is easy to
            build, durable, and most importantly fast.
          </Text>
        </View>

        {/* Product Cards */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: '#1a3a5c' }]}>
            Choose Your Package
          </Text>

          {/* Basic Card */}
          <Pressable
            style={({ pressed }) => [
              styles.productCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.85 },
            ]}
           onPress={() => router.push({ pathname: '/product/[tier]', params: { tier: 'basic' } })}
          >
            <Image
              source={BASIC_PLANS_IMAGE}
              style={{ width: '100%', height: 140 }}
              contentFit="cover"
              transition={200}
              accessibilityLabel="Cardboard boat construction plans"
            />
            <View style={styles.productCardBody}>
              <Text style={[styles.productName, { color: colors.foreground }]}>
                {PRODUCTS.basic.name}
              </Text>
              <Text style={[styles.productTagline, { color: colors.muted }]}>
                {PRODUCTS.basic.tagline}
              </Text>
              <View style={styles.productCardFooter}>
                <Text style={[styles.productPrice, { color: colors.primary }]}>
                  {PRODUCTS.basic.priceDisplay}
                </Text>
                <View style={[styles.viewBtn, { backgroundColor: colors.primary }]}>
                  <Text style={styles.viewBtnText}>View Details</Text>
                </View>
              </View>
            </View>
          </Pressable>

          {/* Premium Card */}
          <Pressable
            style={({ pressed }) => [
              styles.productCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.accent,
                borderWidth: 2,
              },
              pressed && { opacity: 0.85 },
            ]}
           onPress={() => router.push({ pathname: '/product/[tier]', params: { tier: 'premium' } })}
          >
            <View style={[styles.bestValueBadge, { backgroundColor: colors.accent }]}>
              <Text style={styles.bestValueText}>⭐ Best Value</Text>
            </View>
            <Image
              source={UPGRADE_IMAGE}
              style={{ width: '100%', height: 140 }}
              contentFit="cover"
              transition={200}
              accessibilityLabel="Premium Builder Package with Captain Bob"
            />
            <View style={styles.productCardBody}>
              <Text style={[styles.productName, { color: colors.foreground }]}>
                {PRODUCTS.premium.name}
              </Text>
              <Text style={[styles.productTagline, { color: colors.muted }]}>
                {PRODUCTS.premium.tagline}
              </Text>
              <View style={styles.productCardFooter}>
                <Text style={[styles.productPrice, { color: colors.accent }]}>
                  {PRODUCTS.premium.priceDisplay}
                </Text>
                <View style={[styles.viewBtn, { backgroundColor: colors.accent }]}>
                  <Text style={styles.viewBtnText}>View Details</Text>
                </View>
              </View>
            </View>
          </Pressable>
        </View>

        {/* How It Works */}
        <View style={[styles.howItWorksSection, { backgroundColor: colors.primary + '0F' }]}>
          <Text style={[styles.sectionTitle, { color: '#1a3a5c' }]}>
            How It Works
          </Text>
          {HOW_IT_WORKS.map((step, index) => (
            <View key={index} style={styles.howItWorksStep}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: '#1a3a5c' }]}>
                  {step.title}
                </Text>
                <Text style={[styles.stepBody, { color: colors.muted }]}>
                  {step.body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Testimonials */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: '#1a3a5c' }]}>
            What Builders Say
          </Text>
          {TESTIMONIALS.map((t) => (
            <View
              key={t.id}
              style={[styles.testimonialCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.stars}>
                {Array.from({ length: t.rating }).map((_, i) => (
                  <IconSymbol key={i} name="star.fill" size={14} color={colors.accent} />
                ))}
              </View>
              <Text style={[styles.testimonialText, { color: colors.foreground }]}>
                "{t.text}"
              </Text>
              <Text style={[styles.testimonialAuthor, { color: colors.muted }]}>
                — {t.name}, {t.location}
              </Text>
            </View>
          ))}
        </View>

        {/* CTA Banner */}
        <Pressable
          style={({ pressed }) => [
            styles.ctaBanner,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => router.push('/(tabs)/packages')}
        >
          <Text style={styles.ctaBannerTitle}>Ready to Build?</Text>
          <Text style={styles.ctaBannerSubtitle}>View all packages and get started today</Text>
          <View style={[styles.ctaButton, { backgroundColor: colors.accent }]}>
            <Text style={styles.ctaButtonText}>See Packages →</Text>
          </View>
        </Pressable>

        {/* Copyright Footer */}
        <View style={styles.copyrightFooter}>
          <Text style={styles.copyrightText}>© 2026 Champion Cardboard Boat Plans. All Rights Reserved.</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const HOW_IT_WORKS = [
  {
    title: 'Choose Your Package',
    body: 'Select the Basic or Premium package based on your experience level and goals.',
  },
  {
    title: 'Download Instantly',
    body: 'After purchase, your plans are available for immediate download to your device.',
  },
  {
    title: 'Build & Compete',
    body: 'Follow the step-by-step plans to build your boat and dominate the regatta.',
  },
];

const styles = StyleSheet.create({
  heroContainer: {
    width: '100%',
    backgroundColor: '#000',
  },
  // Image native size: 1232 x 684 — aspect ratio = 684/1232
  heroImage: {
    width: '100%',
    aspectRatio: 1232 / 684,
  },
  taglineSection: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  taglineHeading: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 36,
  },
  taglineBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  sectionContainer: {
    padding: 20,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  productCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  bestValueBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bestValueText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  productCardBody: {
    padding: 16,
    gap: 6,
  },
  productName: {
    fontSize: 17,
    fontWeight: '700',
  },
  productTagline: {
    fontSize: 14,
    lineHeight: 20,
  },
  productCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  productPrice: {
    fontSize: 22,
    fontWeight: '800',
  },
  viewBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  viewBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  howItWorksSection: {
    padding: 20,
    gap: 16,
  },
  howItWorksStep: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  stepContent: {
    flex: 1,
    gap: 4,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  stepBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  testimonialCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  testimonialText: {
    fontSize: 14,
    lineHeight: 21,
    fontStyle: 'italic',
  },
  testimonialAuthor: {
    fontSize: 13,
    fontWeight: '600',
  },
  ctaBanner: {
    margin: 20,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  ctaBannerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  ctaBannerSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    textAlign: 'center',
  },
  ctaButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  copyrightFooter: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  copyrightText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
});
