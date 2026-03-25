const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Alias @stripe/stripe-react-native to a stub on all platforms.
//
// WHY: Stripe React Native uses native TurboModules (OnrampSdk, etc.) that must be
// compiled into the app binary. In Expo Go these modules are absent and the package
// crashes at module-load time — before any JS runtime guard can run.
//
// The stub returns a graceful no-op. The real Stripe payment sheet is only invoked
// in the published app build where the native modules are present.
//
// In the published build, app.config.ts includes the @stripe/stripe-react-native
// plugin which compiles the native modules in, so the stub is never reached there.
// (Metro resolver is only used during development / Expo Go.)
const stripeStub = path.resolve(__dirname, "lib/stripe-web-stub.ts");
const originalResolver = config.resolver?.resolveRequest;
config.resolver = config.resolver ?? {};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@stripe/stripe-react-native") {
    return { filePath: stripeStub, type: "sourceFile" };
  }
  if (originalResolver) {
    return originalResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
