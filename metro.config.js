const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Alias @stripe/stripe-react-native to a web stub when bundling for web.
// The Stripe package imports native-only codegen modules that crash Metro on web.
const stripeWebStub = path.resolve(__dirname, "lib/stripe-web-stub.ts");
const originalResolver = config.resolver?.resolveRequest;
config.resolver = config.resolver ?? {};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "@stripe/stripe-react-native") {
    return { filePath: stripeWebStub, type: "sourceFile" };
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
