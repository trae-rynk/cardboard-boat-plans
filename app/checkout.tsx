import { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useStripe } from '@stripe/stripe-react-native';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { PRODUCTS, type ProductTier } from '@/constants/products';
import { trpc } from '@/lib/trpc';

export default function CheckoutScreen() {
  const { tier } = useLocalSearchParams<{ tier: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const product = PRODUCTS[(tier as ProductTier) ?? 'basic'];
  const accentColor = tier === 'premium' ? colors.accent : colors.primary;

  const [email, setEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const createPaymentIntent = trpc.orders.createPaymentIntent.useMutation();
  const confirmPayment = trpc.orders.confirmPayment.useMutation();

  const isFormValid = email.includes('@') && email.includes('.');

  async function handlePay() {
    if (!isFormValid) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setIsProcessing(true);
    try {
      // Step 1: Create PaymentIntent on server
      const intentResult = await createPaymentIntent.mutateAsync({
        productTier: product.id,
        email: email.trim(),
      });

      if (!intentResult.clientSecret || !intentResult.stripeConfigured) {
        // Demo / Stripe not configured — fall through to confirm directly
        const confirmation = await confirmPayment.mutateAsync({
          orderId: intentResult.orderId,
        });
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        router.replace({
          pathname: '/purchase-success',
          params: {
            orderId: String(confirmation.orderId),
            productTier: confirmation.productTier,
          },
        });
        return;
      }

      // Step 2: Initialise the Payment Sheet with the client secret
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Champion Cardboard Boats',
        paymentIntentClientSecret: intentResult.clientSecret,
        defaultBillingDetails: { email: email.trim() },
        appearance: {
          colors: {
            primary: accentColor,
            background: colors.background,
            componentBackground: colors.surface,
            componentBorder: colors.border,
            componentDivider: colors.border,
            primaryText: colors.foreground,
            secondaryText: colors.muted,
            componentText: colors.foreground,
            placeholderText: colors.muted,
          },
        },
        applePay: {
          merchantCountryCode: 'US',
        },
        googlePay: {
          merchantCountryCode: 'US',
          testEnv: true,
        },
      });

      if (initError) {
        throw new Error(initError.message);
      }

      // Step 3: Present the Payment Sheet to the user
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          // User dismissed — not an error, just stop processing
          setIsProcessing(false);
          return;
        }
        throw new Error(presentError.message);
      }

      // Step 4: Payment confirmed by Stripe — tell our server
      const confirmation = await confirmPayment.mutateAsync({
        orderId: intentResult.orderId,
        stripePaymentIntentId: intentResult.stripePaymentIntentId ?? undefined,
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      router.replace({
        pathname: '/purchase-success',
        params: {
          orderId: String(confirmation.orderId),
          productTier: confirmation.productTier,
        },
      });
    } catch (error: any) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert(
        'Payment Failed',
        error?.message ?? 'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Checkout</Text>
        <View style={styles.secureTag}>
          <IconSymbol name="lock.fill" size={12} color={colors.success} />
          <Text style={[styles.secureText, { color: colors.success }]}>Secure</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Order Summary */}
          <View style={[styles.orderSummary, { backgroundColor: accentColor + '12', borderColor: accentColor + '44' }]}>
            <View style={styles.orderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.orderLabel, { color: colors.muted }]}>You're purchasing</Text>
                <Text style={[styles.orderName, { color: colors.foreground }]}>{product.name}</Text>
                <Text style={[styles.orderTagline, { color: colors.muted }]}>{product.tagline}</Text>
              </View>
              <Text style={[styles.orderPrice, { color: accentColor }]}>{product.priceDisplay}</Text>
            </View>
            <View style={[styles.orderDivider, { backgroundColor: accentColor + '33' }]} />
            <View style={styles.orderRow}>
              <Text style={[styles.orderTotalLabel, { color: colors.foreground }]}>Total</Text>
              <Text style={[styles.orderTotalPrice, { color: accentColor }]}>{product.priceDisplay}</Text>
            </View>
          </View>

          {/* Email — needed before opening Payment Sheet */}
          <View style={styles.formSection}>
            <Text style={[styles.formSectionTitle, { color: colors.foreground }]}>
              Contact Information
            </Text>
            <Text style={[styles.formSectionSubtitle, { color: colors.muted }]}>
              Your download link will be sent here
            </Text>
            <FormField
              label="Email Address"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              colors={colors}
            />
          </View>

          {/* Payment method info */}
          <View style={[styles.paymentInfoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.paymentInfoRow}>
              <IconSymbol name="lock.fill" size={16} color={accentColor} />
              <Text style={[styles.paymentInfoTitle, { color: colors.foreground }]}>
                Secure Payment via Stripe
              </Text>
            </View>
            <Text style={[styles.paymentInfoBody, { color: colors.muted }]}>
              Tap "Pay Now" to open the secure Stripe payment sheet. Accepts all major cards, Apple Pay, and Google Pay.
            </Text>
            <View style={styles.cardBrands}>
              {['VISA', 'MC', 'AMEX', 'Apple Pay', 'G Pay'].map((brand) => (
                <View key={brand} style={[styles.cardBrandBadge, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Text style={[styles.cardBrandText, { color: colors.muted }]}>{brand}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Security note */}
          <View style={[styles.securityNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="lock.fill" size={16} color={colors.muted} />
            <Text style={[styles.securityNoteText, { color: colors.muted }]}>
              Your payment is encrypted and processed securely via Stripe. We never store your card details.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky Pay Button */}
      <View
        style={[
          styles.stickyBottom,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.payButton,
            { backgroundColor: isFormValid ? accentColor : colors.border },
            pressed && isFormValid && { opacity: 0.85 },
          ]}
          onPress={handlePay}
          disabled={!isFormValid || isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <IconSymbol name="lock.fill" size={18} color="#FFFFFF" />
              <Text style={styles.payButtonText}>
                Pay {product.priceDisplay} Now
              </Text>
            </>
          )}
        </Pressable>
        <Text style={[styles.refundNote, { color: colors.muted }]}>
          🔒 All sales are final. Digital downloads are non-refundable.
        </Text>
      </View>
    </View>
  );
}

interface FormFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  secureTextEntry?: boolean;
  colors: ReturnType<typeof useColors>;
}

function FormField({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  secureTextEntry,
  colors,
}: FormFieldProps) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        style={[
          styles.fieldInput,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.foreground,
          },
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry}
        returnKeyType="done"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  secureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  secureText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderSummary: {
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  orderName: {
    fontSize: 16,
    fontWeight: '700',
  },
  orderTagline: {
    fontSize: 13,
    marginTop: 2,
  },
  orderPrice: {
    fontSize: 22,
    fontWeight: '800',
    marginLeft: 12,
  },
  orderDivider: {
    height: 1,
    marginVertical: 12,
  },
  orderTotalLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  orderTotalPrice: {
    fontSize: 20,
    fontWeight: '800',
  },
  formSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  formSectionSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  fieldContainer: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  paymentInfoCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  paymentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentInfoTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  paymentInfoBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  cardBrands: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  cardBrandBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  cardBrandText: {
    fontSize: 11,
    fontWeight: '600',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  securityNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  stickyBottom: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 0.5,
    gap: 8,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  refundNote: {
    fontSize: 11,
    textAlign: 'center',
    paddingBottom: 4,
  },
});
