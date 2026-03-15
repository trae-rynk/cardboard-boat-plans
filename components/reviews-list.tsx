import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { StarRatingDisplay, RatingBar } from '@/components/star-rating';
import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/hooks/use-auth';
import { trpc } from '@/lib/trpc';
import type { ProductTier } from '@/constants/products';

// ─── Rating Summary ───────────────────────────────────────────────────────────

interface RatingSummaryProps {
  productTier: ProductTier;
  accentColor: string;
}

export function RatingSummary({ productTier, accentColor }: RatingSummaryProps) {
  const colors = useColors();
  const { data: stats, isLoading } = trpc.reviews.stats.useQuery({ productTier });

  if (isLoading) {
    return (
      <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ActivityIndicator color={accentColor} />
      </View>
    );
  }

  if (!stats || stats.totalReviews === 0) {
    return (
      <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.noReviewsText, { color: colors.muted }]}>
          No reviews yet. Be the first to review!
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Left: big number + stars */}
      <View style={styles.summaryLeft}>
        <Text style={[styles.bigRating, { color: colors.foreground }]}>
          {stats.averageRating.toFixed(1)}
        </Text>
        <StarRatingDisplay rating={stats.averageRating} size={18} />
        <Text style={[styles.totalReviews, { color: colors.muted }]}>
          {stats.totalReviews} review{stats.totalReviews !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Right: distribution bars */}
      <View style={styles.summaryRight}>
        {[5, 4, 3, 2, 1].map((star) => (
          <RatingBar
            key={star}
            starValue={star}
            count={stats.distribution[star] ?? 0}
            total={stats.totalReviews}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Single Review Card ───────────────────────────────────────────────────────

interface ReviewCardProps {
  review: {
    id: number;
    userId: number;
    rating: number;
    title: string | null;
    body: string | null;
    displayName: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  isOwn?: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
}

export function ReviewCard({ review, isOwn, onDelete, onEdit }: ReviewCardProps) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  const name = review.displayName ?? 'Anonymous Builder';
  const dateStr = new Date(review.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const isLong = (review.body?.length ?? 0) > 200;
  const bodyPreview =
    isLong && !expanded ? (review.body?.slice(0, 200) + '…') : review.body;

  return (
    <View style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header row */}
      <View style={styles.reviewHeader}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
          <Text style={[styles.avatarLetter, { color: colors.primary }]}>
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={[styles.reviewerName, { color: colors.foreground }]}>{name}</Text>
            {isOwn && (
              <View style={[styles.ownBadge, { backgroundColor: colors.primary + '18' }]}>
                <Text style={[styles.ownBadgeText, { color: colors.primary }]}>Your Review</Text>
              </View>
            )}
          </View>
          <View style={styles.metaRow}>
            <StarRatingDisplay rating={review.rating} size={13} />
            <Text style={[styles.reviewDate, { color: colors.muted }]}>{dateStr}</Text>
          </View>
        </View>

        {/* Own review actions */}
        {isOwn && (
          <View style={styles.ownActions}>
            {onEdit && (
              <Pressable
                onPress={onEdit}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
                accessibilityLabel="Edit review"
              >
                <IconSymbol name="pencil" size={16} color={colors.primary} />
              </Pressable>
            )}
            {onDelete && (
              <Pressable
                onPress={onDelete}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
                accessibilityLabel="Delete review"
              >
                <IconSymbol name="trash.fill" size={16} color={colors.error} />
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Verified badge */}
      <View style={[styles.verifiedRow, { borderTopColor: colors.border }]}>
        <IconSymbol name="checkmark.seal.fill" size={12} color={colors.success} />
        <Text style={[styles.verifiedText, { color: colors.success }]}>Verified Purchase</Text>
      </View>

      {/* Title */}
      {review.title ? (
        <Text style={[styles.reviewTitle, { color: colors.foreground }]}>{review.title}</Text>
      ) : null}

      {/* Body */}
      {review.body ? (
        <>
          <Text style={[styles.reviewBody, { color: colors.foreground }]}>{bodyPreview}</Text>
          {isLong && (
            <Pressable onPress={() => setExpanded(!expanded)}>
              <Text style={[styles.readMore, { color: colors.primary }]}>
                {expanded ? 'Show less' : 'Read more'}
              </Text>
            </Pressable>
          )}
        </>
      ) : null}
    </View>
  );
}

// ─── Full Reviews Section ─────────────────────────────────────────────────────

interface ReviewsSectionProps {
  productTier: ProductTier;
  accentColor: string;
}

export function ReviewsSection({ productTier, accentColor }: ReviewsSectionProps) {
  const colors = useColors();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [page, setPage] = useState(0);
  const PAGE_SIZE = 5;

  const { data: reviews, isLoading, refetch } = trpc.reviews.list.useQuery({
    productTier,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const { data: canReviewData } = trpc.reviews.canReview.useQuery(
    { productTier },
    { enabled: isAuthenticated }
  );

  const deleteReview = trpc.reviews.delete.useMutation();
  const utils = trpc.useUtils();

  async function handleDelete(reviewId: number) {
    Alert.alert(
      'Delete Review',
      'Are you sure you want to delete your review? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteReview.mutateAsync({ reviewId });
              await utils.reviews.list.invalidate({ productTier });
              await utils.reviews.stats.invalidate({ productTier });
              await utils.reviews.canReview.invalidate({ productTier });
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not delete review.');
            }
          },
        },
      ]
    );
  }

  function handleWriteReview() {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push({ pathname: '/write-review', params: { tier: productTier } } as any);
  }

  return (
    <View style={styles.section}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Customer Reviews</Text>
        {isAuthenticated && canReviewData?.canReview && (
          <Pressable
            style={({ pressed }) => [
              styles.writeReviewBtn,
              { backgroundColor: accentColor },
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleWriteReview}
          >
            <IconSymbol name="pencil" size={14} color="#FFFFFF" />
            <Text style={styles.writeReviewBtnText}>
              {canReviewData.hasReview ? 'Edit Review' : 'Write a Review'}
            </Text>
          </Pressable>
        )}
        {isAuthenticated && !canReviewData?.canReview && (
          <Text style={[styles.purchaseToReview, { color: colors.muted }]}>
            Purchase to review
          </Text>
        )}
        {!isAuthenticated && (
          <Text style={[styles.purchaseToReview, { color: colors.muted }]}>
            Sign in to review
          </Text>
        )}
      </View>

      {/* Rating summary */}
      <RatingSummary productTier={productTier} accentColor={accentColor} />

      {/* Reviews list */}
      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={accentColor} />
        </View>
      ) : !reviews || reviews.length === 0 ? (
        <View style={[styles.emptyReviews, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="star" size={32} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Reviews Yet</Text>
          <Text style={[styles.emptyBody, { color: colors.muted }]}>
            Be the first to share your experience with these plans!
          </Text>
          {isAuthenticated && canReviewData?.canReview && (
            <Pressable
              style={({ pressed }) => [
                styles.firstReviewBtn,
                { backgroundColor: accentColor },
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleWriteReview}
            >
              <Text style={styles.writeReviewBtnText}>Write the First Review</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <>
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              isOwn={canReviewData?.reviewId === review.id}
              onEdit={
                canReviewData?.reviewId === review.id ? handleWriteReview : undefined
              }
              onDelete={
                canReviewData?.reviewId === review.id
                  ? () => handleDelete(review.id)
                  : undefined
              }
            />
          ))}

          {/* Pagination */}
          {(reviews.length === PAGE_SIZE || page > 0) && (
            <View style={styles.pagination}>
              {page > 0 && (
                <Pressable
                  style={({ pressed }) => [
                    styles.pageBtn,
                    { borderColor: colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => setPage(page - 1)}
                >
                  <IconSymbol name="chevron.left" size={14} color={colors.primary} />
                  <Text style={[styles.pageBtnText, { color: colors.primary }]}>Previous</Text>
                </Pressable>
              )}
              {reviews.length === PAGE_SIZE && (
                <Pressable
                  style={({ pressed }) => [
                    styles.pageBtn,
                    { borderColor: colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => setPage(page + 1)}
                >
                  <Text style={[styles.pageBtnText, { color: colors.primary }]}>Next</Text>
                  <IconSymbol name="chevron.right" size={14} color={colors.primary} />
                </Pressable>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryLeft: {
    alignItems: 'center',
    gap: 4,
    minWidth: 72,
  },
  bigRating: {
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 44,
  },
  totalReviews: {
    fontSize: 12,
    marginTop: 2,
  },
  summaryRight: {
    flex: 1,
  },
  noReviewsText: {
    fontSize: 14,
    textAlign: 'center',
    flex: 1,
  },
  reviewCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 17,
    fontWeight: '800',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '700',
  },
  ownBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ownBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  reviewDate: {
    fontSize: 12,
  },
  ownActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
  },
  reviewTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  reviewBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  readMore: {
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    gap: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  writeReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  writeReviewBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  purchaseToReview: {
    fontSize: 12,
    fontWeight: '500',
  },
  loadingRow: {
    padding: 24,
    alignItems: 'center',
  },
  emptyReviews: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  firstReviewBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  pageBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
