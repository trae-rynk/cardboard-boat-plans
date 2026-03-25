/**
 * Native implementation of the Stripe payment sheet hook.
 * Uses @stripe/stripe-react-native which is native-only.
 */
import { useStripe } from "@stripe/stripe-react-native";

export function useStripePayment() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  return {
    isAvailable: true as const,
    presentPaymentSheet: async (params: {
      clientSecret: string;
      email: string;
      accentColor: string;
      backgroundColor?: string;
      surfaceColor?: string;
      borderColor?: string;
      foregroundColor?: string;
      mutedColor?: string;
    }) => {
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "Champion Cardboard Boats",
        paymentIntentClientSecret: params.clientSecret,
        defaultBillingDetails: { email: params.email },
        appearance: {
          colors: {
            primary: params.accentColor,
            background: params.backgroundColor,
            componentBackground: params.surfaceColor,
            componentBorder: params.borderColor,
            componentDivider: params.borderColor,
            primaryText: params.foregroundColor,
            secondaryText: params.mutedColor,
            componentText: params.foregroundColor,
            placeholderText: params.mutedColor,
          },
        },
        applePay: {
          merchantCountryCode: "US",
        },
        googlePay: {
          merchantCountryCode: "US",
          testEnv: true,
        },
      });

      if (initError) {
        return { error: { code: initError.code, message: initError.message } };
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        return { error: { code: presentError.code, message: presentError.message } };
      }

      return {};
    },
  };
}
