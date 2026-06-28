import React from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Header, Btn } from "@/components/ui-kit";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "@/lib/store";
import { setDraft } from "@/lib/sale-draft";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function PartySelectScreen() {
  const colors = useColors();
  const { db, setDB } = useStore();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = (params.kind || "customer") as "customer" | "supplier";
  const [q, setQ] = React.useState("");
  const list = kind === "customer" ? db.customers : db.suppliers;
  const filtered = list.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  const [showCreate, setShowCreate] = React.useState(false);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");

  const pick = (n: string) => {
    setDraft({ party: n });
    router.back();
  };

  const create = async () => {
    if (!name.trim()) return;
    const newId = Math.max(0, ...list.map((p) => p.id)) + 1;
    const newParty = { id: newId, name: name.trim(), phone: phone.trim() || undefined };
    if (kind === "customer") {
      await setDB({ ...db, customers: [...db.customers, newParty] });
    } else {
      await setDB({ ...db, suppliers: [...db.suppliers, newParty] });
    }
    pick(newParty.name);
  };

  return (
    <ScreenContainer>
      <Header
        title={kind === "customer" ? "Zgjidh klientin" : "Zgjidh furnitorin"}
        back={() => router.back()}
      />
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
            placeholder="Kerko..."
            placeholderTextColor={colors.muted}
            style={{ flex: 1, paddingVertical: 12, color: colors.foreground }}
          />
        </View>
      </View>

      {showCreate ? (
        <View style={{ paddingHorizontal: 12 }}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Emri"
            placeholderTextColor={colors.muted}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 12,
              backgroundColor: colors.surface,
              color: colors.foreground,
              marginBottom: 8,
            }}
          />
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Telefon (opsionale)"
            placeholderTextColor={colors.muted}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 12,
              backgroundColor: colors.surface,
              color: colors.foreground,
              marginBottom: 8,
            }}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn title="Anulo" variant="ghost" onPress={() => setShowCreate(false)} />
            <Btn title="Ruaj" onPress={create} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 12 }}>
          <Btn fullWidth icon="plus" title="Shto te ri" variant="soft" onPress={() => setShowCreate(true)} />
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => pick(item.name)}
            style={{
              backgroundColor: colors.surface,
              marginHorizontal: 12,
              marginVertical: 4,
              padding: 14,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontWeight: "800", color: colors.foreground }}>{item.name}</Text>
            {item.phone ? <Text style={{ color: colors.muted, marginTop: 4 }}>{item.phone}</Text> : null}
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}
