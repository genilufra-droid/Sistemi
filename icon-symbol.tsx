// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "doc.text.fill": "receipt-long",
  "chart.bar.fill": "bar-chart",
  "shippingbox.fill": "inventory",
  "list.bullet": "menu",
  "gearshape.fill": "settings",
  "person.2.fill": "people",
  "cart.fill": "shopping-cart",
  "plus": "add",
  "magnifyingglass": "search",
  "trash.fill": "delete",
  "pencil": "edit",
  "printer.fill": "print",
  "square.and.arrow.up": "share",
  "square.and.arrow.down": "file-download",
  "tablecells": "grid-on",
  "creditcard.fill": "payments",
  "building.2.fill": "business",
  "bell.fill": "notifications",
  "checkmark.circle.fill": "check-circle",
  "circle": "radio-button-unchecked",
  "exclamationmark.triangle.fill": "warning",
  "phone.fill": "phone",
  "envelope.fill": "email",
  "location.fill": "location-on",
  "calendar": "event",
  "clock.fill": "schedule",
  "tag.fill": "label",
  "qrcode": "qr-code",
  "doc.fill": "description",
  "arrow.up.right": "north-east",
  "arrow.down.left": "south-west",
  "ellipsis": "more-horiz",
  "ellipsis.circle.fill": "more-vert",
  "xmark": "close",
  "checkmark": "check",
  "line.3.horizontal.decrease": "filter-list",
} as IconMapping;

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
