/**
 * Web stub for @stripe/stripe-react-native
 *
 * Stripe React Native uses native-only codegen modules that crash Metro when
 * bundled for web. This stub exports empty no-ops so web builds succeed.
 * The checkout screen is never reachable on web (it requires the native
 * StripeProvider), so these stubs are never actually called.
 */

export const useStripe = () => ({
  initPaymentSheet: async () => ({ error: { code: "web-not-supported" } }),
  presentPaymentSheet: async () => ({ error: { code: "web-not-supported" } }),
  confirmPayment: async () => ({ error: { code: "web-not-supported" } }),
  createToken: async () => ({ error: { code: "web-not-supported" } }),
  createPaymentMethod: async () => ({ error: { code: "web-not-supported" } }),
  handleNextAction: async () => ({ error: { code: "web-not-supported" } }),
  retrievePaymentIntent: async () => ({ error: { code: "web-not-supported" } }),
  confirmSetupIntent: async () => ({ error: { code: "web-not-supported" } }),
});

export const StripeProvider = ({ children }: { children: React.ReactNode }) => children;

export const CardField = () => null;
export const CardForm = () => null;
export const AuBECSDebitForm = () => null;
export const ApplePayButton = () => null;
export const GooglePayButton = () => null;
export const AddToWalletButton = () => null;
export const AddressSheet = () => null;
export const PaymentSheet = () => null;

export default {};
