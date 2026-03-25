/**
 * Web stub for Stripe payment sheet.
 * The real Stripe React Native SDK is native-only and cannot run on web.
 * This stub is used by Metro when bundling for web targets.
 */
export function useStripePayment() {
  return {
    isAvailable: false as const,
    presentPaymentSheet: async (_params: {
      clientSecret: string;
      email: string;
      accentColor: string;
    }): Promise<{ error?: { code: string; message: string } }> => {
      return { error: { code: "WebUnsupported", message: "Stripe Payment Sheet is not available on web." } };
    },
  };
}
