/**
 * Web-only Stripe checkout using @stripe/react-stripe-js (Stripe Elements).
 * This component is only imported on web (Platform.OS === 'web').
 * On native, the PaymentSheet from stripe-react-native is used instead.
 */
import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useColors } from "@/hooks/use-colors";

const stripePromise = loadStripe(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

interface StripeWebCheckoutProps {
  clientSecret: string;
  amount: number;
  onSuccess: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

function CheckoutForm({
  amount,
  onSuccess,
  onError,
  onCancel,
}: Omit<StripeWebCheckoutProps, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const colors = useColors();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);

  async function handleSubmit() {
    if (!stripe || !elements || !isReady) return;
    setIsProcessing(true);
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // Return URL is required by Stripe but we handle success in-app
          return_url: window.location.href,
        },
        redirect: "if_required",
      });
      if (error) {
        if (error.type === "card_error" || error.type === "validation_error") {
          onError(error.message ?? "Card declined. Please try again.");
        } else {
          onError("An unexpected error occurred. Please try again.");
        }
        setIsProcessing(false);
      } else {
        onSuccess();
      }
    } catch (err: any) {
      onError(err?.message ?? "Payment failed. Please try again.");
      setIsProcessing(false);
    }
  }

  return (
    <View style={styles.formContainer}>
      {/* Stripe PaymentElement renders the card input */}
      <View style={styles.paymentElement}>
        <PaymentElement
          onReady={() => setIsReady(true)}
          options={{
            layout: "tabs",
          }}
        />
      </View>

      {/* Pay button */}
      <Pressable
        onPress={handleSubmit}
        disabled={isProcessing || !isReady}
        style={[
          styles.payButton,
          {
            backgroundColor: isProcessing || !isReady
              ? colors.muted
              : colors.primary,
          },
        ]}
      >
        {isProcessing ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.payButtonText}>
            Pay ${(amount / 100).toFixed(2)}
          </Text>
        )}
      </Pressable>

      {/* Cancel link */}
      <Pressable onPress={onCancel} style={styles.cancelBtn}>
        <Text style={[styles.cancelText, { color: colors.muted }]}>
          Cancel
        </Text>
      </Pressable>

      {/* Security note */}
      <Text style={[styles.secureNote, { color: colors.muted }]}>
        🔒 Secured by Stripe. Your card details are never stored on our servers.
      </Text>
    </View>
  );
}

export function StripeWebCheckout({
  clientSecret,
  amount,
  onSuccess,
  onError,
  onCancel,
}: StripeWebCheckoutProps) {
  const colors = useColors();
  const isDark = colors.background === "#151718" || colors.background?.includes("15");

  const appearance = {
    theme: isDark ? ("night" as const) : ("stripe" as const),
    variables: {
      colorPrimary: colors.primary,
      colorBackground: colors.surface,
      colorText: colors.foreground,
      colorDanger: colors.error,
      fontFamily: "system-ui, sans-serif",
      borderRadius: "10px",
    },
  };

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance,
      }}
    >
      <CheckoutForm
        amount={amount}
        onSuccess={onSuccess}
        onError={onError}
        onCancel={onCancel}
      />
    </Elements>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  paymentElement: {
    minHeight: 200,
  },
  payButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 4,
  },
  payButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 14,
  },
  secureNote: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
