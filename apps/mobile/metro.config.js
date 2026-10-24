// Metro config. Expo handles monorepo resolution; on top of that, force one copy of each
// React/native-UI package. pnpm links @tandrix/ui to its own dev copy of react-native, and a
// second copy at runtime breaks the app, so these always resolve from this app's node_modules.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const singletons = [
  "react",
  "react-native",
  "react-native-svg",
  "react-native-safe-area-context",
  "react-native-screens",
];
const appOrigin = path.join(__dirname, "package.json");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isSingleton = singletons.some((s) => moduleName === s || moduleName.startsWith(`${s}/`));
  return context.resolveRequest(
    isSingleton ? { ...context, originModulePath: appOrigin } : context,
    moduleName,
    platform,
  );
};

module.exports = config;
