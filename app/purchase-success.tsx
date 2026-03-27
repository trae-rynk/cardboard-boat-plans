import { useEffect, useRef, useState } from 'react';
import { Text, View, Pressable, StyleSheet, Animated, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { PRODUCTS, type ProductTier } from '@/constants/products';
import { trpc } from '@/lib/trpc';
import { RateProductModal } from '@/components/rate-product-modal';
import { saveChatCredentials } from '@/lib/chat-store';

export default function PurchaseSuccessScreen() {
  const { orderId, productTier, chatToken: chatTokenParam } = useLocalSearchParams<{
    orderId: string;
    productTier: string;
    chatToken?: string;
  }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const product = PRODUCTS[(productTier as ProductTier) ?? 'basic'];
  const accentColor = productTier === 'premium' ? colors.accent : colors.primary;

  // Rating modal state
  const [ratingModalVisible, setRatingModalVisible] = useState(false);

  // Animation
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Show the rating prompt 1.5s after the success animation completes
      setTimeout(() => setRatingModalVisible(true), 1500);
    });
  }, []);

  const { data: orderData } = trpc.orders.getOrder.useQuery(
    { orderId: Number(orderId) },
    { enabled: !!orderId }
  );

  const { data: downloads } = trpc.downloads.forOrder.useQuery(
    { orderId: Number(orderId) },
    { enabled: !!orderId }
  );

  const guestReviewToken = orderData?.guestReviewToken ?? '';

  // Save Captain Bob chat credentials for Premium orders.
  // chatTokenParam comes directly from the confirmPayment response via route params.
  // This is the most reliable source — orderData.chatToken is not stored in the orders table.
  useEffect(() => {
    if (productTier === 'premium' && chatTokenParam) {
      saveChatCredentials(Number(orderId), chatTokenParam).catch(console.warn);
    }
  }, [chatTokenParam, productTier, orderId]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Icon */}
        <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.success + '18' }]}>
            <IconSymbol name="checkmark.circle.fill" size={80} color={colors.success} />
          </View>
        </Animated.View>

        {/* Heading */}
        <Animated.View style={[styles.textBlock, { opacity: fadeAnim }]}>
          <Text style={[styles.heading, { color: colors.foreground }]}>Purchase Complete!</Text>
          <Text style={[styles.subheading, { color: colors.muted }]}>
            Thank you for your purchase. Your files are ready to download.
          </Text>

          {/* Order Details */}
          <View style={[styles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.orderRow}>
              <Text style={[styles.orderLabel, { color: colors.muted }]}>Product</Text>
              <Text style={[styles.orderValue, { color: colors.foreground }]}>{product.name}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.orderRow}>
              <Text style={[styles.orderLabel, { color: colors.muted }]}>Order ID</Text>
              <Text style={[styles.orderValue, { color: colors.foreground }]}>#{orderId}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.orderRow}>
              <Text style={[styles.orderLabel, { color: colors.muted }]}>Amount Paid</Text>
              <Text style={[styles.orderValueAccent, { color: accentColor }]}>{product.priceDisplay}</Text>
            </View>
          </View>

          {/* Downloads */}
          {downloads && downloads.length > 0 && (
            <View style={styles.downloadsSection}>
              <Text style={[styles.downloadsTitle, { color: colors.foreground }]}>
                Your Downloads
              </Text>
              {downloads.map((dl) => (
                <DownloadItem
                  key={dl.id}
                  download={dl}
                  accentColor={accentColor}
                  colors={colors}
                />
              ))}
            </View>
          )}

          {/* Rate Now button (secondary CTA — in case they dismiss the modal) */}
          {!!guestReviewToken && (
            <Pressable
              style={({ pressed }) => [
                styles.rateNowBtn,
                { borderColor: accentColor, backgroundColor: accentColor + '10' },
                pressed && { opacity: 0.75 },
              ]}
              onPress={() => setRatingModalVisible(true)}
            >
              <IconSymbol name="star.fill" size={16} color={accentColor} />
              <Text style={[styles.rateNowText, { color: accentColor }]}>Rate Your Purchase</Text>
            </Pressable>
          )}
        </Animated.View>

        {/* Actions */}
        <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: accentColor },
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => router.replace('/(tabs)/downloads' as any)}
          >
            <IconSymbol name="arrow.down.circle.fill" size={20} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>View My Downloads</Text>
          </Pressable>

          {productTier === 'premium' && (
            <Pressable
              style={({ pressed }) => [
                styles.chatBtn,
                { backgroundColor: '#1e3a5f' },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => router.push('/(tabs)/chat' as any)}
            >
              <Text style={{ fontSize: 18 }}>⚓</Text>
              <Text style={styles.chatBtnText}>Chat with Captain Bob</Text>
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              { borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => router.replace('/')}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.muted }]}>Back to Home</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      {/* In-app rating modal */}
      {!!guestReviewToken && (
        <RateProductModal
          visible={ratingModalVisible}
          onClose={() => setRatingModalVisible(false)}
          orderId={Number(orderId)}
          guestReviewToken={guestReviewToken}
          productTier={(productTier as ProductTier) ?? 'basic'}
        />
      )}
    </View>
  );
}

interface DownloadItemProps {
  download: {
    id: number;
    token: string;
    displayName: string;
    assetType: string;
    fileSizeBytes: number | null;
  };
  accentColor: string;
  colors: ReturnType<typeof useColors>;
}

function DownloadItem({ download, accentColor, colors }: DownloadItemProps) {
  const iconName =
    download.assetType === 'video_series' ? 'play.circle.fill' : 'doc.fill';

  const fileSizeLabel = download.fileSizeBytes
    ? download.fileSizeBytes > 1_000_000
      ? `${(download.fileSizeBytes / 1_000_000).toFixed(1)} MB`
      : `${Math.round(download.fileSizeBytes / 1024)} KB`
    : '';

  return (
    <View style={[styles.downloadItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <IconSymbol name={iconName as any} size={24} color={accentColor} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.downloadName, { color: colors.foreground }]}>{download.displayName}</Text>
        {fileSizeLabel ? (
          <Text style={[styles.downloadSize, { color: colors.muted }]}>{fileSizeLabel}</Text>
        ) : null}
      </View>
      <View style={[styles.readyBadge, { backgroundColor: colors.success + '18' }]}>
        <Text style={[styles.readyText, { color: colors.success }]}>Ready</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
    alignItems: 'center',
    gap: 24,
    flexGrow: 1,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    width: '100%',
    gap: 16,
    alignItems: 'center',
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  subheading: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  orderCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  orderValue: {
    fontSize: 14,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  orderValueAccent: {
    fontSize: 16,
    fontWeight: '800',
  },
  divider: {
    height: 1,
  },
  downloadsSection: {
    width: '100%',
    gap: 10,
  },
  downloadsTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  downloadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  downloadName: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  downloadSize: {
    fontSize: 12,
    marginTop: 2,
  },
  readyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  readyText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rateNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    width: '100%',
    justifyContent: 'center',
  },
  rateNowText: {
    fontSize: 15,
    fontWeight: '700',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  chatBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
