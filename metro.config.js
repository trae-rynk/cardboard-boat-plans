const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Alias @stripe/stripe-react-native to a stub on all platforms during development.
//
// WHY: Stripe React Native uses native TurboModules (OnrampSdk, etc.) that must be
// compiled into the app binary. In Expo Go these modules are absent and the package
// crashes at module-load time — before any JS runtime guard can run.
//
// The stub returns graceful no-ops. The checkout screen shows a clear
// "Payment available in the published app" banner when running in Expo Go.
//
// In the PUBLISHED BUILD, the @stripe/stripe-react-native Expo plugin
// (configured in app.config.ts) compiles the real native modules into the binary,
// so Stripe works fully in the production APK/IPA.
const stripeStub = path.resolve(__dirname, "lib/stripe-web-stub.ts");
const cssInteropStub = path.resolve(
  __dirname,
  "lib/react-native-css-interop-stub.ts"
);
const originalResolver = config.resolver?.resolveRequest;
config.resolver = config.resolver ?? {};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@stripe/stripe-react-native") {
    return { filePath: stripeStub, type: "sourceFile" };
  }
  // react-native-css-interop is a native-only styling package used by NativeWind
  // to apply Tailwind classes in React Native. On web, NativeWind uses standard
  // CSS and never needs this package. Stubbing it out prevents Metro from trying
  // to bundle the real package (which references native modules and a build-time
  // cache file that doesn't exist during the web export).
  if (moduleName === "react-native-css-interop" && platform === "web") {
    return { filePath: cssInteropStub, type: "sourceFile" };
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
