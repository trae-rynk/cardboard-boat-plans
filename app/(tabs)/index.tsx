import { ScrollView, Text, View, Pressable, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { PRODUCTS, TESTIMONIALS } from '@/constants/products';

const HERO_IMAGE = require('@/assets/images/hero1.jpg');
const BASIC_PLANS_IMAGE = require('@/assets/images/cover2a.jpg');
const UPGRADE_IMAGE = require('@/assets/images/captain-bob-premium.jpg');

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

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  if (isDesktop) {
    return <DesktopHomeScreen colors={colors} router={router} />;
  }

  // ─── Mobile layout (unchanged) ───────────────────────────────────────────
  return (
    <ScreenContainer edges={[]} containerClassName="bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Hero Image */}
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
          <MobileProductCard
            image={BASIC_PLANS_IMAGE}
            name={PRODUCTS.basic.name}
            tagline={PRODUCTS.basic.tagline}
            price={PRODUCTS.basic.priceDisplay}
            priceColor={colors.primary}
            borderColor={colors.border}
            accentColor={colors.primary}
            onPress={() => router.push({ pathname: '/product/[tier]', params: { tier: 'basic' } })}
            colors={colors}
          />
          <MobileProductCard
            image={UPGRADE_IMAGE}
            name={PRODUCTS.premium.name}
            tagline={PRODUCTS.premium.tagline}
            price={PRODUCTS.premium.priceDisplay}
            priceColor={colors.accent}
            borderColor={colors.accent}
            accentColor={colors.accent}
            isBestValue
            showCaptainBob
            onPress={() => router.push({ pathname: '/product/[tier]', params: { tier: 'premium' } })}
            colors={colors}
          />
        </View>

        {/* How It Works */}
        <View style={[styles.howItWorksSection, { backgroundColor: colors.primary + '0F' }]}>
          <Text style={[styles.sectionTitle, { color: '#1a3a5c' }]}>How It Works</Text>
          {HOW_IT_WORKS.map((step, index) => (
            <View key={index} style={styles.howItWorksStep}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: '#1a3a5c' }]}>{step.title}</Text>
                <Text style={[styles.stepBody, { color: colors.muted }]}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Testimonials */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: '#1a3a5c' }]}>What Builders Say</Text>
          {TESTIMONIALS.map((t) => (
            <View key={t.id} style={[styles.testimonialCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.stars}>
                {Array.from({ length: t.rating }).map((_, i) => (
                  <IconSymbol key={i} name="star.fill" size={14} color={colors.accent} />
                ))}
              </View>
              <Text style={[styles.testimonialText, { color: colors.foreground }]}>"{t.text}"</Text>
              <Text style={[styles.testimonialAuthor, { color: colors.muted }]}>— {t.name}, {t.location}</Text>
            </View>
          ))}
        </View>

        {/* CTA Banner */}
        <Pressable
          style={({ pressed }) => [styles.ctaBanner, { backgroundColor: colors.primary }, pressed && { opacity: 0.9 }]}
          onPress={() => router.push('/(tabs)/packages')}
        >
          <Text style={styles.ctaBannerTitle}>Ready to Build?</Text>
          <Text style={styles.ctaBannerSubtitle}>View all packages and get started today</Text>
          <View style={[styles.ctaButton, { backgroundColor: colors.accent }]}>
            <Text style={styles.ctaButtonText}>See Packages →</Text>
          </View>
        </Pressable>

        {/* Footer */}
        <View style={styles.copyrightFooter}>
          <View style={styles.footerLinks}>
            <Text style={[styles.footerLink, { color: colors.primary }]} onPress={() => router.push('/privacy-policy' as any)}>Privacy Policy</Text>
            <Text style={styles.copyrightText}> · </Text>
            <Text style={[styles.footerLink, { color: colors.primary }]} onPress={() => router.push('/no-refunds-policy' as any)}>Sales Policy</Text>
          </View>
          <Text style={styles.copyrightText}>© 2026 Champion Cardboard Boat Plans. All Rights Reserved.</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Desktop Layout ───────────────────────────────────────────────────────────

function DesktopHomeScreen({ colors, router }: { colors: ReturnType<typeof useColors>; router: ReturnType<typeof useRouter> }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Top Nav */}
      <View style={[deskStyles.topNav, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={deskStyles.navInner}>
          <View style={deskStyles.navBrand}>
            <IconSymbol name="trophy.fill" size={20} color={colors.accent} />
            <Text style={[deskStyles.navBrandText, { color: colors.foreground }]}>Champion Cardboard Boats</Text>
          </View>
          <View style={deskStyles.navLinks}>
            <Pressable onPress={() => router.push('/(tabs)/packages')} style={({ pressed }) => [deskStyles.navLink, pressed && { opacity: 0.7 }]}>
              <Text style={[deskStyles.navLinkText, { color: colors.foreground }]}>Packages</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/(tabs)/downloads')} style={({ pressed }) => [deskStyles.navLink, pressed && { opacity: 0.7 }]}>
              <Text style={[deskStyles.navLinkText, { color: colors.foreground }]}>My Downloads</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/(tabs)/chat')} style={({ pressed }) => [deskStyles.navLink, pressed && { opacity: 0.7 }]}>
              <Text style={[deskStyles.navLinkText, { color: colors.foreground }]}>Captain Bob</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: '/product/[tier]', params: { tier: 'premium' } })}
              style={({ pressed }) => [deskStyles.navCta, { backgroundColor: colors.accent }, pressed && { opacity: 0.85 }]}
            >
              <Text style={deskStyles.navCtaText}>Buy Now</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Hero Section ── */}
        <View style={[deskStyles.heroSection, { backgroundColor: '#0a1628' }]}>
          <View style={deskStyles.heroInner}>
            {/* Left: headline + CTA */}
            <View style={deskStyles.heroLeft}>
              <View style={[deskStyles.heroBadge, { backgroundColor: colors.accent + '33', borderColor: colors.accent + '66' }]}>
                <IconSymbol name="trophy.fill" size={16} color={colors.accent} />
                <Text style={[deskStyles.heroBadgeText, { color: colors.accent }]}>Eight-Time Championship Winners</Text>
              </View>
              <Text style={deskStyles.heroHeadline}>
                Build a Cardboard Boat That{' '}
                <Text style={{ color: colors.accent }}>Actually Wins</Text>
              </Text>
              <Text style={deskStyles.heroSubheadline}>
                Most cardboard boats sink on the first lap. Ours has won 8 championships. Get the exact plans, step-by-step instructions, and expert support that make the difference.
              </Text>
              <View style={deskStyles.heroCtas}>
                <Pressable
                  onPress={() => router.push({ pathname: '/product/[tier]', params: { tier: 'premium' } })}
                  style={({ pressed }) => [deskStyles.heroCtaPrimary, { backgroundColor: colors.accent }, pressed && { opacity: 0.88 }]}
                >
                  <Text style={deskStyles.heroCtaPrimaryText}>Get Premium Plans — $39.99</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push({ pathname: '/product/[tier]', params: { tier: 'basic' } })}
                  style={({ pressed }) => [deskStyles.heroCtaSecondary, { borderColor: 'rgba(255,255,255,0.4)' }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={deskStyles.heroCtaSecondaryText}>View Basic Plans — $19.99</Text>
                </Pressable>
              </View>
              {/* Trust signals */}
              <View style={deskStyles.trustRow}>
                {['🏆 8 Championships', '⬇️ Instant Download', '🔒 Secure Checkout'].map((t) => (
                  <Text key={t} style={deskStyles.trustItem}>{t}</Text>
                ))}
              </View>
            </View>
            {/* Right: hero image */}
            <View style={deskStyles.heroRight}>
              <Image
                source={HERO_IMAGE}
                style={deskStyles.heroImg}
                contentFit="contain"
                transition={300}
                accessibilityLabel="Eight-time champion cardboard boat racer"
              />
            </View>
          </View>
        </View>

        {/* ── Package Comparison ── */}
        <View style={[deskStyles.section, { backgroundColor: colors.background }]}>
          <View style={deskStyles.sectionInner}>
            <Text style={[deskStyles.sectionHeading, { color: '#1a3a5c' }]}>Choose Your Package</Text>
            <Text style={[deskStyles.sectionSubheading, { color: colors.muted }]}>
              Both packages include the complete award-winning boat design. Premium adds 30 days of live expert support.
            </Text>
            <View style={deskStyles.packagesRow}>
              {/* Basic */}
              <Pressable
                style={({ pressed }) => [deskStyles.packageCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.9 }]}
                onPress={() => router.push({ pathname: '/product/[tier]', params: { tier: 'basic' } })}
              >
                <Image source={BASIC_PLANS_IMAGE} style={deskStyles.packageImg} contentFit="cover" transition={200} />
                <View style={deskStyles.packageBody}>
                  <Text style={[deskStyles.packageName, { color: colors.foreground }]}>{PRODUCTS.basic.name}</Text>
                  <Text style={[deskStyles.packageTagline, { color: colors.muted }]}>{PRODUCTS.basic.tagline}</Text>
                  <View style={deskStyles.packageFeatures}>
                    {PRODUCTS.basic.features.filter(f => f.included).map((f, i) => (
                      <View key={i} style={deskStyles.featureRow}>
                        <Text style={{ color: colors.success, fontSize: 14 }}>✓</Text>
                        <Text style={[deskStyles.featureText, { color: colors.foreground }]}>{f.text}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={[deskStyles.packageCta, { backgroundColor: colors.primary }]}>
                    <Text style={deskStyles.packageCtaText}>{PRODUCTS.basic.priceDisplay} — View Details</Text>
                  </View>
                </View>
              </Pressable>

              {/* Premium */}
              <Pressable
                style={({ pressed }) => [deskStyles.packageCard, deskStyles.packageCardPremium, { backgroundColor: colors.surface, borderColor: colors.accent }, pressed && { opacity: 0.9 }]}
                onPress={() => router.push({ pathname: '/product/[tier]', params: { tier: 'premium' } })}
              >
                <View style={[deskStyles.bestValueBadge, { backgroundColor: colors.accent }]}>
                  <Text style={deskStyles.bestValueText}>⭐ Best Value</Text>
                </View>
                <Image source={UPGRADE_IMAGE} style={deskStyles.packageImg} contentFit="cover" transition={200} />
                <View style={deskStyles.packageBody}>
                  <Text style={[deskStyles.packageName, { color: colors.foreground }]}>{PRODUCTS.premium.name}</Text>
                  <Text style={[deskStyles.packageTagline, { color: colors.muted }]}>{PRODUCTS.premium.tagline}</Text>
                  <View style={[deskStyles.captainBobStrip, { backgroundColor: '#1B4F8A' }]}>
                    <Text style={deskStyles.captainBobText}>⚓  Includes 30-day live Captain Bob support</Text>
                  </View>
                  <View style={deskStyles.packageFeatures}>
                    {PRODUCTS.premium.features.filter(f => f.included).map((f, i) => (
                      <View key={i} style={deskStyles.featureRow}>
                        <Text style={{ color: colors.success, fontSize: 14 }}>✓</Text>
                        <Text style={[deskStyles.featureText, { color: colors.foreground }]}>{f.text}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={[deskStyles.packageCta, { backgroundColor: colors.accent }]}>
                    <Text style={deskStyles.packageCtaText}>{PRODUCTS.premium.priceDisplay} — View Details</Text>
                  </View>
                </View>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── How It Works ── */}
        <View style={[deskStyles.section, { backgroundColor: colors.primary + '0F' }]}>
          <View style={deskStyles.sectionInner}>
            <Text style={[deskStyles.sectionHeading, { color: '#1a3a5c' }]}>How It Works</Text>
            <View style={deskStyles.stepsRow}>
              {HOW_IT_WORKS.map((step, index) => (
                <View key={index} style={[deskStyles.stepCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[deskStyles.stepNum, { backgroundColor: colors.primary }]}>
                    <Text style={deskStyles.stepNumText}>{index + 1}</Text>
                  </View>
                  <Text style={[deskStyles.stepCardTitle, { color: '#1a3a5c' }]}>{step.title}</Text>
                  <Text style={[deskStyles.stepCardBody, { color: colors.muted }]}>{step.body}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Testimonials ── */}
        <View style={[deskStyles.section, { backgroundColor: colors.background }]}>
          <View style={deskStyles.sectionInner}>
            <Text style={[deskStyles.sectionHeading, { color: '#1a3a5c' }]}>What Builders Say</Text>
            <View style={deskStyles.testimonialsRow}>
              {TESTIMONIALS.map((t) => (
                <View key={t.id} style={[deskStyles.testimonialCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', gap: 2, marginBottom: 8 }}>
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <IconSymbol key={i} name="star.fill" size={14} color={colors.accent} />
                    ))}
                  </View>
                  <Text style={[deskStyles.testimonialText, { color: colors.foreground }]}>"{t.text}"</Text>
                  <Text style={[deskStyles.testimonialAuthor, { color: colors.muted }]}>— {t.name}, {t.location}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── CTA Banner ── */}
        <View style={[deskStyles.ctaBanner, { backgroundColor: colors.primary }]}>
          <Text style={deskStyles.ctaTitle}>Ready to Build a Championship Boat?</Text>
          <Text style={deskStyles.ctaSubtitle}>Join hundreds of builders who've used our plans to compete — and win.</Text>
          <Pressable
            onPress={() => router.push({ pathname: '/product/[tier]', params: { tier: 'premium' } })}
            style={({ pressed }) => [deskStyles.ctaBtn, { backgroundColor: colors.accent }, pressed && { opacity: 0.88 }]}
          >
            <Text style={deskStyles.ctaBtnText}>Get the Plans Now →</Text>
          </Pressable>
        </View>

        {/* ── Footer ── */}
        <View style={[deskStyles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={deskStyles.footerInner}>
            <Text style={[deskStyles.footerBrand, { color: colors.foreground }]}>© 2026 Champion Cardboard Boat Plans. All Rights Reserved.</Text>
            <View style={deskStyles.footerLinks}>
              <Text style={[deskStyles.footerLink, { color: colors.primary }]} onPress={() => router.push('/privacy-policy' as any)}>Privacy Policy</Text>
              <Text style={[deskStyles.footerSep, { color: colors.border }]}>·</Text>
              <Text style={[deskStyles.footerLink, { color: colors.primary }]} onPress={() => router.push('/no-refunds-policy' as any)}>Sales Policy</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Mobile sub-components ────────────────────────────────────────────────────

function MobileProductCard({
  image, name, tagline, price, priceColor, borderColor, accentColor,
  isBestValue, showCaptainBob, onPress, colors,
}: {
  image: any; name: string; tagline: string; price: string;
  priceColor: string; borderColor: string; accentColor: string;
  isBestValue?: boolean; showCaptainBob?: boolean;
  onPress: () => void; colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.productCard,
        { backgroundColor: colors.surface, borderColor, borderWidth: isBestValue ? 2 : 1 },
        pressed && { opacity: 0.85 },
      ]}
      onPress={onPress}
    >
      {isBestValue && (
        <View style={[styles.bestValueBadge, { backgroundColor: accentColor }]}>
          <Text style={styles.bestValueText}>⭐ Best Value</Text>
        </View>
      )}
      <Image source={image} style={{ width: '100%', height: 140 }} contentFit="cover" transition={200} />
      <View style={styles.productCardBody}>
        <Text style={[styles.productName, { color: colors.foreground }]}>{name}</Text>
        <Text style={[styles.productTagline, { color: colors.muted }]}>{tagline}</Text>
        {showCaptainBob && (
          <View style={[styles.captainBobStrip, { backgroundColor: '#1B4F8A' }]}>
            <Text style={styles.captainBobStripText}>⚓  Includes 30-day live Captain Bob support</Text>
          </View>
        )}
        <View style={styles.productCardFooter}>
          <Text style={[styles.productPrice, { color: priceColor }]}>{price}</Text>
          <View style={[styles.viewBtn, { backgroundColor: accentColor }]}>
            <Text style={styles.viewBtnText}>View Details</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Mobile StyleSheet ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  heroContainer: { width: '100%', backgroundColor: '#000' },
  heroImage: { width: '100%', aspectRatio: 1232 / 684 },
  taglineSection: { padding: 24, alignItems: 'center', gap: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  taglineHeading: { fontSize: 28, fontWeight: '800', textAlign: 'center', lineHeight: 36 },
  taglineBody: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  sectionContainer: { padding: 20, gap: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  productCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  bestValueBadge: { position: 'absolute', top: 12, right: 12, zIndex: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  bestValueText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  productCardBody: { padding: 16, gap: 6 },
  productName: { fontSize: 17, fontWeight: '700' },
  productTagline: { fontSize: 14, lineHeight: 20 },
  captainBobStrip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4 },
  captainBobStripText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  productCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  productPrice: { fontSize: 22, fontWeight: '800' },
  viewBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  viewBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  howItWorksSection: { padding: 20, gap: 16 },
  howItWorksStep: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  stepNumber: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumberText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  stepContent: { flex: 1, gap: 4 },
  stepTitle: { fontSize: 16, fontWeight: '800' },
  stepBody: { fontSize: 14, lineHeight: 20 },
  testimonialCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 8 },
  stars: { flexDirection: 'row', gap: 2 },
  testimonialText: { fontSize: 14, lineHeight: 21, fontStyle: 'italic' },
  testimonialAuthor: { fontSize: 13, fontWeight: '600' },
  ctaBanner: { margin: 20, borderRadius: 16, padding: 24, alignItems: 'center', gap: 8 },
  ctaBannerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  ctaBannerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 14, textAlign: 'center' },
  ctaButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 4 },
  ctaButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  copyrightFooter: { paddingVertical: 20, paddingHorizontal: 20, alignItems: 'center', gap: 6 },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerLink: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  copyrightText: { fontSize: 12, color: '#9BA1A6', textAlign: 'center' },
});

// ─── Desktop StyleSheet ───────────────────────────────────────────────────────

const deskStyles = StyleSheet.create({
  // Top nav
  topNav: { borderBottomWidth: 1, paddingVertical: 14, paddingHorizontal: 32 },
  navInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1200, alignSelf: 'center', width: '100%' },
  navBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navBrandText: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  navLinks: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navLink: { paddingHorizontal: 14, paddingVertical: 8 },
  navLinkText: { fontSize: 15, fontWeight: '500' },
  navCta: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 22, marginLeft: 8 },
  navCtaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // Hero
  heroSection: { paddingVertical: 72, paddingHorizontal: 32 },
  heroInner: { flexDirection: 'row', alignItems: 'center', gap: 48, maxWidth: 1200, alignSelf: 'center', width: '100%' },
  heroLeft: { flex: 1, gap: 20 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  heroBadgeText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  heroHeadline: { fontSize: 48, fontWeight: '900', color: '#FFFFFF', lineHeight: 56, letterSpacing: -1 },
  heroSubheadline: { fontSize: 18, lineHeight: 28, color: 'rgba(255,255,255,0.75)' },
  heroCtas: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  heroCtaPrimary: { paddingHorizontal: 28, paddingVertical: 16, borderRadius: 12 },
  heroCtaPrimaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  heroCtaSecondary: { paddingHorizontal: 28, paddingVertical: 16, borderRadius: 12, borderWidth: 1.5 },
  heroCtaSecondaryText: { color: 'rgba(255,255,255,0.9)', fontSize: 17, fontWeight: '600' },
  trustRow: { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },
  trustItem: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '500' },
  heroRight: { flex: 1, alignItems: 'center' },
  heroImg: { width: '100%', aspectRatio: 1232 / 684, borderRadius: 16 },

  // Sections
  section: { paddingVertical: 64, paddingHorizontal: 32 },
  sectionInner: { maxWidth: 1200, alignSelf: 'center', width: '100%', gap: 32 },
  sectionHeading: { fontSize: 36, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  sectionSubheading: { fontSize: 17, lineHeight: 26, textAlign: 'center', marginTop: -16 },

  // Packages
  packagesRow: { flexDirection: 'row', gap: 24 },
  packageCard: { flex: 1, borderRadius: 20, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 },
  packageCardPremium: { borderWidth: 2 },
  packageImg: { width: '100%', height: 200 },
  packageBody: { padding: 24, gap: 12 },
  packageName: { fontSize: 20, fontWeight: '800' },
  packageTagline: { fontSize: 15, lineHeight: 22 },
  captainBobStrip: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  captainBobText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  packageFeatures: { gap: 8, marginTop: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  featureText: { fontSize: 14, lineHeight: 20, flex: 1 },
  packageCta: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  packageCtaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  bestValueBadge: { position: 'absolute', top: 16, right: 16, zIndex: 10, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14 },
  bestValueText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // How it works
  stepsRow: { flexDirection: 'row', gap: 20 },
  stepCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 28, gap: 12, alignItems: 'center' },
  stepNum: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  stepCardTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  stepCardBody: { fontSize: 14, lineHeight: 22, textAlign: 'center' },

  // Testimonials
  testimonialsRow: { flexDirection: 'row', gap: 20 },
  testimonialCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 24, gap: 8 },
  testimonialText: { fontSize: 15, lineHeight: 24, fontStyle: 'italic', flex: 1 },
  testimonialAuthor: { fontSize: 14, fontWeight: '600' },

  // CTA banner
  ctaBanner: { paddingVertical: 72, paddingHorizontal: 32, alignItems: 'center', gap: 16 },
  ctaTitle: { color: '#FFFFFF', fontSize: 40, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  ctaSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 18, textAlign: 'center', lineHeight: 28 },
  ctaBtn: { paddingHorizontal: 36, paddingVertical: 18, borderRadius: 14, marginTop: 8 },
  ctaBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },

  // Footer
  footer: { borderTopWidth: 1, paddingVertical: 28, paddingHorizontal: 32 },
  footerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1200, alignSelf: 'center', width: '100%', flexWrap: 'wrap', gap: 12 },
  footerBrand: { fontSize: 13 },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerLink: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  footerSep: { fontSize: 13 },
});
