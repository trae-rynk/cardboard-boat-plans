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
  TextInput,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/hooks/use-auth';
import { useOrderStore, saveOrderId } from '@/lib/order-store';
import { saveChatCredentials } from '@/lib/chat-store';

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

  // No purchases found — show empty state with Recover My Purchase form
  if (!downloads || downloads.length === 0) {
    return (
      <ScreenContainer>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <Text style={styles.headerTitle}>My Downloads</Text>
          <Text style={styles.headerSubtitle}>Your purchased files</Text>
        </View>
        <EmptyStateWithRecovery
          colors={colors}
          onRecovered={() => {
            guestRefetch();
          }}
          onShop={() => router.push('/(tabs)/packages' as any)}
        />
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

// ─── Empty State with Recovery Form ─────────────────────────────────────────

function EmptyStateWithRecovery({
  colors,
  onRecovered,
  onShop,
}: {
  colors: ReturnType<typeof useColors>;
  onRecovered: () => void;
  onShop: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [orderIdText, setOrderIdText] = useState('');
  const [error, setError] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [recoveredTier, setRecoveredTier] = useState<string | null>(null);

  const recoverMutation = trpc.downloads.recoverPurchase.useMutation();

  const handleRecover = async () => {
    setError('');
    const orderId = parseInt(orderIdText.trim(), 10);
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (isNaN(orderId) || orderId <= 0) {
      setError('Please enter a valid order number.');
      return;
    }
    setRecovering(true);
    try {
      const result = await recoverMutation.mutateAsync({ orderId, email: email.trim() });
      // Save orderId locally so downloads tab loads automatically next time
      await saveOrderId(result.orderId);
      // If Premium, also restore Captain Bob access
      if (result.chatToken) {
        await saveChatCredentials(result.orderId, result.chatToken);
      }
      setRecoveredTier(result.productTier);
      setRecovered(true);
      onRecovered();
    } catch (err: any) {
      setError(err?.message ?? 'Could not find your purchase. Please check your details and try again.');
    } finally {
      setRecovering(false);
    }
  };

  if (recovered) {
    return (
      <ScrollView contentContainerStyle={styles.emptyContainer}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.success + '18' }]}>
          <IconSymbol name="checkmark.seal.fill" size={40} color={colors.success} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Access Restored!</Text>
        <Text style={[styles.emptyBody, { color: colors.muted }]}>
          Your purchase has been recovered.
          {recoveredTier === 'premium'
            ? ' Your PDF download and Captain Bob chat access are now available on this device.'
            : ' Your PDF download is now available on this device.'}
        </Text>
        <Text style={[styles.emptyBody, { color: colors.muted, marginTop: -8 }]}>
          Pull down to refresh if your files don't appear immediately.
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
        <IconSymbol name="arrow.down.circle.fill" size={40} color={colors.muted} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Purchases Found</Text>
      <Text style={[styles.emptyBody, { color: colors.muted }]}>
        Purchased on another device? Enter your order details below to restore access to your plans and Captain Bob.
      </Text>

      {!showForm ? (
        <>
          <Pressable
            style={({ pressed }) => [
              styles.recoverBtn,
              { backgroundColor: '#1e3a5f' },
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => setShowForm(true)}
          >
            <IconSymbol name="arrow.clockwise" size={16} color="#FFFFFF" />
            <Text style={styles.recoverBtnText}>Recover My Purchase</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              { borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
            onPress={onShop}
          >
            <IconSymbol name="tag.fill" size={16} color={colors.primary} />
            <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>View Packages</Text>
          </Pressable>
        </>
      ) : (
        <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>Recover My Purchase</Text>
          <Text style={[styles.formSub, { color: colors.muted }]}>
            Enter the email and order number from your purchase confirmation email.
          </Text>

          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Email address"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Order number (from your confirmation email)"
            placeholderTextColor={colors.muted}
            value={orderIdText}
            onChangeText={setOrderIdText}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={handleRecover}
          />

          {error ? (
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.recoverBtn,
              { backgroundColor: '#1e3a5f' },
              (pressed || recovering) && { opacity: 0.75 },
            ]}
            onPress={handleRecover}
            disabled={recovering}
          >
            {recovering ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <IconSymbol name="arrow.clockwise" size={16} color="#FFFFFF" />
                <Text style={styles.recoverBtnText}>Restore Access</Text>
              </>
            )}
          </Pressable>

          <Pressable onPress={() => { setShowForm(false); setError(''); }} style={{ marginTop: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Download Card ────────────────────────────────────────────────────────────

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
  const accentColor = isPremium ? colors.primary : colors.primary;

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
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
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
  recoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    minHeight: 50,
  },
  recoverBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    width: '100%',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  formCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  formSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
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
