import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { StarRatingPicker } from '@/components/star-rating';
import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/hooks/use-auth';
import { trpc } from '@/lib/trpc';
import { PRODUCTS, type ProductTier } from '@/constants/products';

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Great',
  5: 'Excellent!',
};

export default function WriteReviewScreen() {
  const { tier } = useLocalSearchParams<{ tier: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();

  const productTier = (tier as ProductTier) ?? 'basic';
  const product = PRODUCTS[productTier];
  const accentColor = productTier === 'premium' ? colors.accent : colors.primary;

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing review if the user already left one
  const { data: existingReview, isLoading: loadingExisting } =
    trpc.reviews.myReview.useQuery(
      { productTier },
      { enabled: isAuthenticated }
    );

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating);
      setTitle(existingReview.title ?? '');
      setBody(existingReview.body ?? '');
      setDisplayName(existingReview.displayName ?? user?.name ?? '');
    }
  }, [existingReview]);

  const submitReview = trpc.reviews.submit.useMutation();
  const utils = trpc.useUtils();

  const isEditing = !!existingReview;
  const isValid = rating >= 1 && rating <= 5;

  async function handleSubmit() {
    if (!isValid) {
      Alert.alert('Rating Required', 'Please select a star rating before submitting.');
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setIsSubmitting(true);
    try {
      await submitReview.mutateAsync({
        productTier,
        rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        displayName: displayName.trim() || undefined,
      });

      // Invalidate reviews cache so the list refreshes
      await utils.reviews.list.invalidate({ productTier });
      await utils.reviews.stats.invalidate({ productTier });
      await utils.reviews.myReview.invalidate({ productTier });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        isEditing ? 'Review Updated!' : 'Review Submitted!',
        isEditing
          ? 'Your review has been updated. Thank you!'
          : 'Thank you for sharing your experience! Your review will help other builders.',
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch (error: any) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert('Error', error?.message ?? 'Could not submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <IconSymbol name="xmark" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Write a Review</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centered}>
          <IconSymbol name="person.fill" size={48} color={colors.muted} />
          <Text style={[styles.gateTitle, { color: colors.foreground }]}>Sign In Required</Text>
          <Text style={[styles.gateBody, { color: colors.muted }]}>
            You need to be signed in to leave a review.
          </Text>
        </View>
      </View>
    );
  }

  if (loadingExisting) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <IconSymbol name="xmark" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Write a Review</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            borderBottomColor: colors.border,
            paddingTop: insets.top + 12,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <IconSymbol name="xmark" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {isEditing ? 'Edit Your Review' : 'Write a Review'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Product context */}
          <View style={[styles.productBadge, { backgroundColor: accentColor + '15', borderColor: accentColor + '40' }]}>
            <IconSymbol name="doc.fill" size={16} color={accentColor} />
            <Text style={[styles.productBadgeText, { color: accentColor }]}>
              {product.name}
            </Text>
            <View style={[styles.verifiedBadge, { backgroundColor: colors.success + '18' }]}>
              <IconSymbol name="checkmark.seal.fill" size={12} color={colors.success} />
              <Text style={[styles.verifiedText, { color: colors.success }]}>Verified Purchase</Text>
            </View>
          </View>

          {/* Star Picker */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              Your Rating <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <StarRatingPicker value={rating} onChange={setRating} size={44} />
            {rating > 0 && (
              <Text style={[styles.ratingLabel, { color: accentColor }]}>
                {RATING_LABELS[rating]}
              </Text>
            )}
          </View>

          {/* Display Name */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              Display Name
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
              ]}
              placeholder="Your name (shown on review)"
              placeholderTextColor={colors.muted + '88'}
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={100}
              returnKeyType="next"
              autoCapitalize="words"
            />
          </View>

          {/* Review Title */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              Review Title <Text style={[styles.optional, { color: colors.muted }]}>(optional)</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
              ]}
              placeholder="Summarize your experience"
              placeholderTextColor={colors.muted + '88'}
              value={title}
              onChangeText={setTitle}
              maxLength={120}
              returnKeyType="next"
            />
            <Text style={[styles.charCount, { color: colors.muted }]}>{title.length}/120</Text>
          </View>

          {/* Review Body */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              Your Review <Text style={[styles.optional, { color: colors.muted }]}>(optional)</Text>
            </Text>
            <TextInput
              style={[
                styles.textarea,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
              ]}
              placeholder="Share your experience building the boat. What worked well? Any tips for other builders?"
              placeholderTextColor={colors.muted + '88'}
              value={body}
              onChangeText={setBody}
              maxLength={2000}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              returnKeyType="done"
            />
            <Text style={[styles.charCount, { color: colors.muted }]}>{body.length}/2000</Text>
          </View>

          {/* Guidelines */}
          <View style={[styles.guidelines, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.guidelinesTitle, { color: colors.foreground }]}>Review Guidelines</Text>
            <Text style={[styles.guidelinesText, { color: colors.muted }]}>
              • Focus on your experience with the plans and building process{'\n'}
              • Be specific — mention what worked and what you'd improve{'\n'}
              • Keep it respectful and constructive{'\n'}
              • Only reviews from verified purchasers are accepted
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit Button */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            { backgroundColor: isValid ? accentColor : colors.border },
            pressed && isValid && { opacity: 0.85 },
          ]}
          onPress={handleSubmit}
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <IconSymbol name="star.fill" size={18} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>
                {isEditing ? 'Update Review' : 'Submit Review'}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  gateTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  gateBody: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  productBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  productBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
  },
  section: {
    marginBottom: 20,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  optional: {
    fontSize: 13,
    fontWeight: '400',
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 2,
  },
  guidelines: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: 4,
  },
  guidelinesTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  guidelinesText: {
    fontSize: 13,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
