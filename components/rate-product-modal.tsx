import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { StarRatingPicker } from '@/components/star-rating';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import { PRODUCTS, type ProductTier } from '@/constants/products';

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Great',
  5: 'Excellent!',
};

interface RateProductModalProps {
  visible: boolean;
  onClose: () => void;
  orderId: number;
  guestReviewToken: string;
  productTier: ProductTier;
}

export function RateProductModal({
  visible,
  onClose,
  orderId,
  guestReviewToken,
  productTier,
}: RateProductModalProps) {
  const colors = useColors();
  const product = PRODUCTS[productTier];
  const accentColor = productTier === 'premium' ? colors.accent : colors.primary;

  const [rating, setRating] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submitReview = trpc.reviews.submit.useMutation();
  const utils = trpc.useUtils();

  const isValid = rating >= 1 && rating <= 5;

  async function handleSubmit() {
    if (!isValid) {
      Alert.alert('Rating Required', 'Please tap a star to rate your experience.');
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsSubmitting(true);
    try {
      await submitReview.mutateAsync({
        orderId,
        guestReviewToken,
        rating,
        body: body.trim() || undefined,
        displayName: displayName.trim() || undefined,
      });

      await utils.reviews.list.invalidate({ productTier });
      await utils.reviews.stats.invalidate({ productTier });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setSubmitted(true);
    } catch (error: any) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert('Error', error?.message ?? 'Could not submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setRating(0);
    setDisplayName('');
    setBody('');
    setSubmitted(false);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          {/* Handle bar */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {submitted ? (
            /* ── Thank You State ── */
            <View style={styles.thankYou}>
              <View style={[styles.thankYouIcon, { backgroundColor: colors.success + '18' }]}>
                <IconSymbol name="checkmark.circle.fill" size={56} color={colors.success} />
              </View>
              <Text style={[styles.thankYouTitle, { color: colors.foreground }]}>
                Thank You! 🏆
              </Text>
              <Text style={[styles.thankYouBody, { color: colors.muted }]}>
                Your review has been submitted and will help other builders decide if these plans are right for them.
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.doneBtn,
                  { backgroundColor: accentColor },
                  pressed && { opacity: 0.85 },
                ]}
                onPress={handleClose}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            /* ── Review Form ── */
            <ScrollView
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View style={styles.formHeader}>
                <View>
                  <Text style={[styles.formTitle, { color: colors.foreground }]}>
                    Rate Your Purchase
                  </Text>
                  <Text style={[styles.formSubtitle, { color: colors.muted }]}>
                    {product.name}
                  </Text>
                </View>
                <Pressable
                  onPress={handleClose}
                  style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
                  accessibilityLabel="Close"
                >
                  <IconSymbol name="xmark" size={18} color={colors.muted} />
                </Pressable>
              </View>

              {/* Verified badge */}
              <View style={[styles.verifiedRow, { backgroundColor: colors.success + '12' }]}>
                <IconSymbol name="checkmark.seal.fill" size={14} color={colors.success} />
                <Text style={[styles.verifiedText, { color: colors.success }]}>
                  Verified Purchase — Order #{orderId}
                </Text>
              </View>

              {/* Star Picker */}
              <View style={styles.starSection}>
                <Text style={[styles.label, { color: colors.foreground }]}>
                  How would you rate these plans?
                </Text>
                <StarRatingPicker value={rating} onChange={(v) => {
                  setRating(v);
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }} size={48} />
                {rating > 0 && (
                  <Text style={[styles.ratingLabel, { color: accentColor }]}>
                    {RATING_LABELS[rating]}
                  </Text>
                )}
              </View>

              {/* Name field */}
              <View style={styles.fieldSection}>
                <Text style={[styles.label, { color: colors.foreground }]}>
                  Your Name <Text style={[styles.optional, { color: colors.muted }]}>(optional)</Text>
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
                  ]}
                  placeholder="e.g. Mike from Ohio"
                  placeholderTextColor={colors.muted + '88'}
                  value={displayName}
                  onChangeText={setDisplayName}
                  maxLength={100}
                  returnKeyType="next"
                  autoCapitalize="words"
                />
              </View>

              {/* Comment field */}
              <View style={styles.fieldSection}>
                <Text style={[styles.label, { color: colors.foreground }]}>
                  Tell us about your build <Text style={[styles.optional, { color: colors.muted }]}>(optional)</Text>
                </Text>
                <TextInput
                  style={[
                    styles.textarea,
                    { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
                  ]}
                  placeholder="How did the build go? Any tips for other builders?"
                  placeholderTextColor={colors.muted + '88'}
                  value={body}
                  onChangeText={setBody}
                  maxLength={500}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                <Text style={[styles.charCount, { color: colors.muted }]}>{body.length}/500</Text>
              </View>

              {/* Buttons */}
              <View style={styles.buttonRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.skipBtn,
                    { borderColor: colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={handleClose}
                >
                  <Text style={[styles.skipBtnText, { color: colors.muted }]}>Maybe Later</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.submitBtn,
                    { backgroundColor: isValid ? accentColor : colors.muted + '44', flex: 1 },
                    pressed && isValid && { opacity: 0.85 },
                  ]}
                  onPress={handleSubmit}
                  disabled={isSubmitting || !isValid}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <IconSymbol name="star.fill" size={16} color="#FFFFFF" />
                      <Text style={styles.submitBtnText}>Submit Review</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  formContent: {
    padding: 24,
    gap: 20,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  formSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  starSection: {
    alignItems: 'center',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  ratingLabel: {
    fontSize: 17,
    fontWeight: '800',
  },
  fieldSection: {
    gap: 8,
  },
  optional: {
    fontSize: 12,
    fontWeight: '400',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 96,
  },
  charCount: {
    fontSize: 11,
    textAlign: 'right',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  skipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
    borderRadius: 12,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  // Thank you state
  thankYou: {
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  thankYouIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thankYouTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  thankYouBody: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  doneBtn: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
