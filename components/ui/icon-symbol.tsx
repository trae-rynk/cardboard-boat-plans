// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "tag.fill": "local-offer",
  "arrow.down.circle.fill": "download",
  "checkmark.circle.fill": "check-circle",
  "xmark.circle.fill": "cancel",
  "star.fill": "star",
  "lock.fill": "lock",
  "creditcard.fill": "credit-card",
  "doc.fill": "description",
  "play.circle.fill": "play-circle-filled",
  "arrow.down.to.line": "save-alt",
  "checkmark.seal.fill": "verified",
  "exclamationmark.circle.fill": "error",
  "info.circle.fill": "info",
  "person.fill": "person",
  "cart.fill": "shopping-cart",
  "gift.fill": "card-giftcard",
  "trophy.fill": "emoji-events",
  "boat.fill": "directions-boat",
  "photo.fill": "photo",
  "video.fill": "videocam",
  "repeat": "repeat",
  "clock.fill": "access-time",
  "envelope.fill": "email",
} as unknown as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
