import { useEffect, useRef, useState } from 'react';
import { Text, View, Pressable, StyleSheet, Animated, Platform, ScrollView, Alert, Linking, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { PRODUCTS, type ProductTier } from '@/constants/products';
import { trpc } from '@/lib/trpc';
import { saveChatCredentials } from '@/lib/chat-store';
import { saveOrderId } from '@/lib/order-store';

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
    ]).start();
  }, []);

  const { data: orderData } = trpc.orders.getOrder.useQuery(
    { orderId: Number(orderId) },
    { enabled: !!orderId }
  );

  const { data: downloads } = trpc.downloads.forOrder.useQuery(
    { orderId: Number(orderId) },
    { enabled: !!orderId }
  );

  // Persist orderId locally so Downloads tab works without sign-in
  useEffect(() => {
    if (orderId) {
      saveOrderId(Number(orderId)).catch(console.warn);
    }
  }, [orderId]);

  // Save Captain Bob chat credentials for Premium orders immediately from route params
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
            Thank you for your purchase. Your files are ready to download below.
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

          {/* Downloads — each with its own Download button */}
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
        </Animated.View>

        {/* Actions */}
        <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
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
  const [isDownloading, setIsDownloading] = useState(false);

  const resolveToken = trpc.downloads.resolveToken.useQuery(
    { token: download.token },
    { enabled: false }
  );

  const fileSizeLabel = download.fileSizeBytes
    ? download.fileSizeBytes > 1_000_000
      ? `${(download.fileSizeBytes / 1_000_000).toFixed(1)} MB`
      : `${Math.round(download.fileSizeBytes / 1024)} KB`
    : '';

  async function handleDownload() {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsDownloading(true);
    try {
      const result = await resolveToken.refetch();
      if (result.data?.url) {
        if (Platform.OS === 'web') {
          // On web, open in a new tab so the browser handles the download
          window.open(result.data.url, '_blank');
        } else {
          await Linking.openURL(result.data.url);
        }
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert('Download Error: ' + (error?.message ?? 'Could not start download. Please try again.'));
      } else {
        Alert.alert('Download Error', error?.message ?? 'Could not start download. Please try again.');
      }
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <View style={[styles.downloadItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.downloadItemTop}>
        <IconSymbol name="doc.fill" size={24} color={accentColor} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.downloadName, { color: colors.foreground }]}>{download.displayName}</Text>
          {fileSizeLabel ? (
            <Text style={[styles.downloadSize, { color: colors.muted }]}>{fileSizeLabel}</Text>
          ) : null}
        </View>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.downloadBtn,
          { backgroundColor: accentColor },
          pressed && { opacity: 0.85 },
          isDownloading && { opacity: 0.6 },
        ]}
        onPress={handleDownload}
        disabled={isDownloading}
      >
        {isDownloading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <IconSymbol name="arrow.down.circle.fill" size={18} color="#FFFFFF" />
            <Text style={styles.downloadBtnText}>Download PDF</Text>
          </>
        )}
      </Pressable>
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
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  downloadItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  actions: {
    width: '100%',
    gap: 12,
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
