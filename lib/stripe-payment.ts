/**
 * Native implementation of the Stripe payment sheet hook.
 * Uses @stripe/stripe-react-native which requires a custom native build.
 * In Expo Go the native module is not available, so we return the same
 * no-op stub as the web version to avoid crashing on module evaluation.
 */
import { isExpoGo } from "@/lib/is-expo-go";

export function useStripePayment() {
  // In Expo Go, Stripe native modules are not compiled in — return a graceful stub.
  if (isExpoGo) {
    return {
      isAvailable: false as const,
      presentPaymentSheet: async (_params: {
        clientSecret: string;
        email: string;
        accentColor: string;
        backgroundColor?: string;
        surfaceColor?: string;
        borderColor?: string;
        foregroundColor?: string;
        mutedColor?: string;
      }): Promise<{ error?: { code: string; message: string } }> => {
        return {
          error: {
            code: "ExpoGoUnsupported",
            message: "Stripe Payment Sheet is not available in Expo Go.",
          },
        };
      },
    };
  }

  // Real native implementation — only reached in a proper dev/production build.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useStripe } = require("@stripe/stripe-react-native");
  // eslint-disable-next-line react-hooks/rules-of-hooks
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
