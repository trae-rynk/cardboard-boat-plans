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

  const product = PRODUCTS[(tier as ProductTier) ?? 'basic'];
  const accentColor = tier === 'premium' ? colors.accent : colors.primary;

  const [email, setEmail] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const createPaymentIntent = trpc.orders.createPaymentIntent.useMutation();
  const confirmPayment = trpc.orders.confirmPayment.useMutation();

  function formatCardNumber(text: string) {
    const cleaned = text.replace(/\D/g, '').slice(0, 16);
    return cleaned.replace(/(.{4})/g, '$1 ').trim();
  }

  function formatExpiry(text: string) {
    const cleaned = text.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length >= 3) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    }
    return cleaned;
  }

  const isFormValid =
    email.includes('@') &&
    cardNumber.replace(/\s/g, '').length === 16 &&
    expiry.length === 5 &&
    cvc.length >= 3 &&
    cardName.trim().length > 0;

  async function handlePay() {
    if (!isFormValid) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setIsProcessing(true);
    try {
      // Step 1: Create payment intent on server
      const intentResult = await createPaymentIntent.mutateAsync({
        productTier: product.id,
        email: email.trim(),
      });

      // Step 2: In a real app, we'd use Stripe SDK to confirm the payment
      // For this demo, we simulate a successful payment
      if (!intentResult.stripeConfigured) {
        // Demo mode: simulate payment processing
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Step 3: Confirm payment on server and create download tokens
      const confirmation = await confirmPayment.mutateAsync({
        orderId: intentResult.orderId,
        stripePaymentIntentId: undefined, // Would be from Stripe SDK in production
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Navigate to success screen
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

          {/* Payment Form */}
          <View style={styles.formSection}>
            <Text style={[styles.formSectionTitle, { color: colors.foreground }]}>
              Contact Information
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

          <View style={styles.formSection}>
            <Text style={[styles.formSectionTitle, { color: colors.foreground }]}>
              Payment Details
            </Text>
            <View style={[styles.cardBrands, { marginBottom: 12 }]}>
              {['VISA', 'MC', 'AMEX'].map((brand) => (
                <View key={brand} style={[styles.cardBrandBadge, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <Text style={[styles.cardBrandText, { color: colors.muted }]}>{brand}</Text>
                </View>
              ))}
            </View>

            <FormField
              label="Name on Card"
              placeholder="John Smith"
              value={cardName}
              onChangeText={setCardName}
              autoCapitalize="words"
              colors={colors}
            />
            <FormField
              label="Card Number"
              placeholder="1234 5678 9012 3456"
              value={cardNumber}
              onChangeText={(t) => setCardNumber(formatCardNumber(t))}
              keyboardType="numeric"
              colors={colors}
            />
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Expiry"
                  placeholder="MM/YY"
                  value={expiry}
                  onChangeText={(t) => setExpiry(formatExpiry(t))}
                  keyboardType="numeric"
                  colors={colors}
                />
              </View>
              <View style={{ width: 16 }} />
              <View style={{ flex: 1 }}>
                <FormField
                  label="CVC"
                  placeholder="123"
                  value={cvc}
                  onChangeText={(t) => setCvc(t.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="numeric"
                  secureTextEntry
                  colors={colors}
                />
              </View>
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
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
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
        placeholderTextColor={colors.muted + '88'}
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
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
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
    margin: 20,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderLabel: {
    fontSize: 12,
    fontWeight: '500',
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
    fontSize: 20,
    fontWeight: '800',
  },
  orderDivider: {
    height: 1,
  },
  orderTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  orderTotalPrice: {
    fontSize: 22,
    fontWeight: '800',
  },
  formSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 4,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  cardBrands: {
    flexDirection: 'row',
    gap: 8,
  },
  cardBrandBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  cardBrandText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  fieldContainer: {
    marginBottom: 12,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  cardRow: {
    flexDirection: 'row',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  securityNoteText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  stickyBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
    alignItems: 'center',
  },
  payButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  refundNote: {
    fontSize: 12,
    fontWeight: '500',
  },
});
