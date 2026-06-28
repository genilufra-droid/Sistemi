import React from "react";
import {
  Pressable,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewProps,
  StyleSheet,
  PressableProps,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function Card({ style, ...props }: ViewProps) {
  const colors = useColors();
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: 10,
          padding: 14,
          marginHorizontal: 12,
          marginVertical: 6,
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
    />
  );
}

export function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View>
      {title ? (
        <Text style={{ paddingHorizontal: 16, paddingTop: 16, fontWeight: "800", color: colors.muted, fontSize: 13, textTransform: "uppercase" }}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

type FieldProps = TextInputProps & {
  label: string;
  containerStyle?: any;
};

export function Field({ label, containerStyle, style, ...rest }: FieldProps) {
  const colors = useColors();
  return (
    <View style={[{ marginVertical: 6 }, containerStyle]}>
      <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 4, fontWeight: "700" }}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        {...rest}
        style={[
          {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            backgroundColor: colors.surface,
            paddingHorizontal: 12,
            paddingVertical: 12,
            color: colors.foreground,
            fontSize: 16,
            minHeight: 48,
          },
          style,
        ]}
      />
    </View>
  );
}

type BtnProps = PressableProps & {
  title: string;
  variant?: "primary" | "soft" | "warn" | "ghost" | "success";
  icon?: string;
  fullWidth?: boolean;
  size?: "md" | "sm" | "lg";
};

export function Btn({ title, variant = "primary", icon, fullWidth, size = "md", style, ...rest }: BtnProps) {
  const colors = useColors();
  let bg = colors.primary;
  let fg = "#fff";
  let border = colors.primary;
  if (variant === "soft") {
    bg = "#e8f5ff";
    fg = "#10628d";
    border = "#cfe6f8";
  } else if (variant === "warn") {
    bg = "#fee2e2";
    fg = "#991b1b";
    border = "#fecaca";
  } else if (variant === "ghost") {
    bg = "transparent";
    fg = colors.foreground;
    border = colors.border;
  } else if (variant === "success") {
    bg = colors.success;
    fg = "#fff";
    border = colors.success;
  }
  const padV = size === "lg" ? 14 : size === "sm" ? 8 : 11;
  const padH = size === "lg" ? 18 : size === "sm" ? 10 : 14;
  const fs = size === "lg" ? 17 : size === "sm" ? 13 : 15;
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          borderColor: border,
          borderWidth: 1,
          borderRadius: 8,
          paddingVertical: padV,
          paddingHorizontal: padH,
          opacity: pressed ? 0.85 : 1,
          alignSelf: fullWidth ? "stretch" : "auto",
          gap: 6,
        },
        typeof style === "function" ? null : style,
      ]}
    >
      {icon ? <IconSymbol name={icon as any} size={fs + 2} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: "800", fontSize: fs }}>{title}</Text>
    </Pressable>
  );
}

export function Header({
  title,
  back,
  right,
}: {
  title: string;
  back?: () => void;
  right?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: 8,
      }}
    >
      {back ? (
        <Pressable onPress={back} hitSlop={10} style={{ padding: 4 }}>
          <Text style={{ fontSize: 28, color: colors.foreground, fontWeight: "800", lineHeight: 30 }}>‹</Text>
        </Pressable>
      ) : (
        <View style={{ width: 8 }} />
      )}
      <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground, flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "paid" | "open" | "neutral" }) {
  let bg = "#e5e7eb";
  let fg = "#374151";
  if (tone === "paid") {
    bg = "#d9f8ee";
    fg = "#0a9b6d";
  } else if (tone === "open") {
    bg = "#fff1c7";
    fg = "#b77900";
  }
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" }}>
      <Text style={{ color: fg, fontWeight: "800", fontSize: 12 }}>{children}</Text>
    </View>
  );
}

export function Toggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", backgroundColor: "#f0f1f3", borderRadius: 999, padding: 3 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{
              backgroundColor: active ? colors.success : "transparent",
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: active ? "#fff" : "#7d838d", fontWeight: "800", fontSize: 13 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
});
