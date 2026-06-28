import React from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Header } from "@/components/ui-kit";
import { router } from "expo-router";
import { fmt, supplierDue, useStore } from "@/lib/store";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function SuppliersScreen() {
  const colors = useColors();
  const { db } = useStore();
  const [q, setQ] = React.useState("");
  const list = db.suppliers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <ScreenContainer>
      <Header title="Furnitoret" back={() => router.back()} />
      <View style={{ padding: 12 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surface,
            borderRadius: 8,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 8,
          }}
        >
          <IconSymbol name="magnifyingglass" size={20} color={colors.primary} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Kerko furnitor"
            placeholderTextColor={colors.muted}
            style={{ flex: 1, paddingVertical: 12, color: colors.foreground }}
          />
        </View>
      </View>
      <FlatList
        data={list}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => {
          const due = supplierDue(db, item.name);
          return (
            <Pressable
              onPress={() => router.push({ pathname: "/supplier/[name]", params: { name: item.name } } as any)}
              style={{
                marginHorizontal: 12,
                marginVertical: 4,
                backgroundColor: colors.surface,
                padding: 14,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "800", color: colors.foreground }}>{item.name}</Text>
                <Text style={{ color: due > 0 ? colors.error : colors.success, fontWeight: "800" }}>
                  {fmt(due)}
                </Text>
              </View>
              {item.phone ? <Text style={{ color: colors.muted, marginTop: 4 }}>{item.phone}</Text> : null}
            </Pressable>
          );
        }}
      />
      <Pressable
        onPress={() => router.push({ pathname: "/party-form", params: { kind: "supplier" } } as any)}
        style={({ pressed }) => ({
          position: "absolute",
          bottom: 20,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.error,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.85 : 1,
          elevation: 6,
        })}
      >
        <IconSymbol name="plus" size={28} color="#fff" />
      </Pressable>
    </ScreenContainer>
  );
}
