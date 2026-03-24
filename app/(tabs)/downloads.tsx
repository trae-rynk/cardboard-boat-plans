import { useState } from 'react';
import {
  Text,
  View,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { StarRatingDisplay } from '@/components/star-rating';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/hooks/use-auth';
import type { ProductTier } from '@/constants/products';

export default function DownloadsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const {
    data: myDownloads,
    isLoading,
    refetch,
  } = trpc.downloads.myDownloads.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (authLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!isAuthenticated) {
    return (
      <ScreenContainer>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <Text style={styles.headerTitle}>My Downloads</Text>
          <Text style={styles.headerSubtitle}>Your purchased files</Text>
        </View>
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
            <IconSymbol name="person.fill" size={40} color={colors.muted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sign In Required</Text>
          <Text style={[styles.emptyBody, { color: colors.muted }]}>
            Sign in to access your purchased downloads and order history.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.signInBtn,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => router.push('/oauth/callback' as any)}
          >
            <Text style={styles.signInBtnText}>Sign In</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.browseBtn,
              { borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => router.push('/(tabs)/packages' as any)}
          >
            <Text style={[styles.browseBtnText, { color: colors.primary }]}>
              Browse Packages
            </Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <Text style={styles.headerTitle}>My Downloads</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </ScreenContainer>
    );
  }

  if (!myDownloads || myDownloads.length === 0) {
    return (
      <ScreenContainer>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <Text style={styles.headerTitle}>My Downloads</Text>
          <Text style={styles.headerSubtitle}>Your purchased files</Text>
        </View>
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
            <IconSymbol name="arrow.down.circle.fill" size={40} color={colors.muted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Purchases Yet</Text>
          <Text style={[styles.emptyBody, { color: colors.muted }]}>
            Your purchased plans and resources will appear here after checkout.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.signInBtn,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => router.push('/(tabs)/packages' as any)}
          >
            <IconSymbol name="tag.fill" size={16} color="#FFFFFF" />
            <Text style={styles.signInBtnText}>View Packages</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Text style={styles.headerTitle}>My Downloads</Text>
        <Text style={styles.headerSubtitle}>
          {myDownloads.length} file{myDownloads.length !== 1 ? 's' : ''} available
        </Text>
      </View>

      <FlatList
        data={myDownloads}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        showsVerticalScrollIndicator={false}
        onRefresh={refetch}
        refreshing={isLoading}
        renderItem={({ item }) => (
          <DownloadCard
            download={item}
            colors={colors}
          />
        )}
        ListHeaderComponent={
          <View style={[styles.welcomeCard, { backgroundColor: colors.success + '12', borderColor: colors.success + '33' }]}>
            <IconSymbol name="checkmark.seal.fill" size={18} color={colors.success} />
            <Text style={[styles.welcomeText, { color: colors.success }]}>
              Welcome back, {user?.name ?? 'Builder'}! Your files are ready.
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

interface DownloadCardProps {
  download: {
    id: number;
    token: string;
    displayName: string;
    assetType: string;
    fileSizeBytes: number | null;
    downloadCount: number;
    createdAt: Date;
    order: {
      id: number;
      productTier: string;
      amountCents: number;
      createdAt: Date;
    };
  };
  colors: ReturnType<typeof useColors>;
}

function DownloadCard({ download, colors }: DownloadCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const router = useRouter();
  const productTier = download.order.productTier as ProductTier;

  // Only show review button on the first asset per order (avoid duplicates)
  const isFirstAsset = download.assetType === 'pdf_plans';

  // Fetch the order's guestReviewToken so the review button can deep-link correctly
  const { data: orderData } = trpc.orders.getOrder.useQuery(
    { orderId: download.order.id },
    { enabled: isFirstAsset }
  );
  const guestReviewToken = orderData?.guestReviewToken ?? '';

  const { data: myReview } = trpc.reviews.myReview.useQuery(
    { orderId: download.order.id, guestReviewToken },
    { enabled: isFirstAsset && !!guestReviewToken }
  );
  const resolveToken = trpc.downloads.resolveToken.useQuery(
    { token: download.token },
    { enabled: false }
  );

  const isVideo = download.assetType === 'video_series';
  const isPremium = download.order.productTier === 'premium';
  const accentColor = isPremium ? colors.accent : colors.primary;

  const fileSizeLabel = download.fileSizeBytes
    ? download.fileSizeBytes > 1_000_000_000
      ? `${(download.fileSizeBytes / 1_000_000_000).toFixed(1)} GB`
      : download.fileSizeBytes > 1_000_000
      ? `${(download.fileSizeBytes / 1_000_000).toFixed(1)} MB`
      : `${Math.round(download.fileSizeBytes / 1024)} KB`
    : '';

  const purchaseDate = new Date(download.order.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  async function handleDownload() {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsDownloading(true);
    try {
      const result = await resolveToken.refetch();
      if (result.data?.url) {
        await Linking.openURL(result.data.url);
      }
    } catch (error: any) {
      Alert.alert('Download Error', error?.message ?? 'Could not start download. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <View style={[styles.downloadCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.assetIcon, { backgroundColor: accentColor + '18' }]}>
          <IconSymbol
            name={isVideo ? 'play.circle.fill' : 'doc.fill'}
            size={24}
            color={accentColor}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.downloadName, { color: colors.foreground }]}>
            {download.displayName}
          </Text>
          <View style={styles.metaRow}>
            {fileSizeLabel ? (
              <Text style={[styles.metaText, { color: colors.muted }]}>{fileSizeLabel}</Text>
            ) : null}
            {fileSizeLabel ? (
              <Text style={[styles.metaDot, { color: colors.muted }]}>·</Text>
            ) : null}
            <Text style={[styles.metaText, { color: colors.muted }]}>
              {download.downloadCount > 0
                ? `Downloaded ${download.downloadCount}×`
                : 'Not yet downloaded'}
            </Text>
          </View>
        </View>
        <View style={[styles.tierBadge, { backgroundColor: accentColor + '18' }]}>
          <Text style={[styles.tierBadgeText, { color: accentColor }]}>
            {isPremium ? 'Premium' : 'Basic'}
          </Text>
        </View>
      </View>

      {/* Order info */}
      <View style={[styles.orderInfo, { borderTopColor: colors.border }]}>
        <View style={styles.orderInfoRow}>
          <IconSymbol name="clock.fill" size={13} color={colors.muted} />
          <Text style={[styles.orderInfoText, { color: colors.muted }]}>
            Purchased {purchaseDate}
          </Text>
        </View>
        <Text style={[styles.orderInfoText, { color: colors.muted }]}>
          Order #{download.order.id}
        </Text>
      </View>

      {/* Download Button */}
      <Pressable
        style={({ pressed }) => [
          styles.downloadBtn,
          { backgroundColor: accentColor },
          pressed && { opacity: 0.85 },
        ]}
        onPress={handleDownload}
        disabled={isDownloading}
      >
        {isDownloading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <IconSymbol
              name={isVideo ? 'play.circle.fill' : 'arrow.down.to.line'}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.downloadBtnText}>
              {isVideo ? 'Watch Videos' : 'Download PDF'}
            </Text>
          </>
        )}
      </Pressable>

      {/* Write / Edit Review Button (shown only on pdf_plans asset) */}
      {isFirstAsset && !!guestReviewToken && (
        <Pressable
          style={({ pressed }) => [
            styles.reviewBtn,
            { borderColor: accentColor, backgroundColor: accentColor + '10' },
            pressed && { opacity: 0.75 },
          ]}
          onPress={() =>
            router.push({ pathname: '/write-review', params: { orderId: download.order.id, token: guestReviewToken } } as any)
          }
        >
          {myReview ? (
            <>
              <View style={styles.reviewBtnLeft}>
                <IconSymbol name="pencil" size={15} color={accentColor} />
                <Text style={[styles.reviewBtnText, { color: accentColor }]}>Edit Your Review</Text>
              </View>
              <StarRatingDisplay rating={myReview.rating} size={13} />
            </>
          ) : (
            <>
              <IconSymbol name="star.fill" size={15} color={accentColor} />
              <Text style={[styles.reviewBtnText, { color: accentColor }]}>Write a Review</Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    gap: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  signInBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  browseBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  browseBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  welcomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  welcomeText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  downloadCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
  },
  assetIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadName: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  metaText: {
    fontSize: 12,
  },
  metaDot: {
    fontSize: 12,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  orderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  orderInfoText: {
    fontSize: 12,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 12,
    marginTop: 4,
    paddingVertical: 13,
    borderRadius: 12,
  },
  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  reviewBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
