import Constants, { ExecutionEnvironment } from "expo-constants";

/**
 * Returns true when the app is running inside Expo Go.
 * Stripe React Native requires a custom dev/production build and
 * will crash in Expo Go — use this flag to degrade gracefully.
 */
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
