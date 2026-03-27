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
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/hooks/use-auth';
import { useOrderStore } from '@/lib/order-store';
import type { ProductTier } from '@/constants/products';

export default function DownloadsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { orderIds } = useOrderStore();

  // Guest path: fetch downloads by locally-stored orderIds (no auth required)
  const {
    data: guestDownloads,
    isLoading: guestLoading,
    refetch: guestRefetch,
  } = trpc.downloads.forOrders.useQuery(
    { orderIds },
    { enabled: !isAuthenticated && orderIds.length > 0 }
  );

  // Authenticated path: fetch all downloads for the signed-in user
  const {
    data: myDownloads,
    isLoading: authDownloadsLoading,
    refetch: authRefetch,
  } = trpc.downloads.myDownloads.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const downloads = isAuthenticated ? myDownloads : guestDownloads;
  const isLoading = authLoading || (isAuthenticated ? authDownloadsLoading : guestLoading);
  const refetch = isAuthenticated ? authRefetch : guestRefetch;

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

  // No purchases found (guest with no saved orders, or signed-in with no orders)
  if (!downloads || downloads.length === 0) {
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
            Your purchased plans will appear here after checkout. Files are saved to this device automatically.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => router.push('/(tabs)/packages' as any)}
          >
            <IconSymbol name="tag.fill" size={16} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>View Packages</Text>
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
          {downloads.length} file{downloads.length !== 1 ? 's' : ''} available
        </Text>
      </View>

      <FlatList
        data={downloads}
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
              {isAuthenticated
                ? `Welcome back, ${user?.name ?? 'Builder'}! Your files are ready.`
                : 'Your purchase is confirmed. Files are ready to download.'}
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
  const isPremium = download.order.productTier === 'premium';
  const accentColor = isPremium ? colors.accent : colors.primary;

  const resolveToken = trpc.downloads.resolveToken.useQuery(
    { token: download.token },
    { enabled: false }
  );

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
        if (Platform.OS === 'web') {
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
    <View style={[styles.downloadCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.assetIcon, { backgroundColor: accentColor + '18' }]}>
          <IconSymbol name="doc.fill" size={24} color={accentColor} />
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
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
    paddingHorizontal: 32,
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
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
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
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  downloadCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    lineHeight: 20,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
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
    paddingVertical: 13,
    borderRadius: 10,
  },
  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
