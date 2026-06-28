/**
 * Inventar Fizik — physical stock count. Pick a warehouse, the screen lists every
 * product with its system stock; enter the counted quantity (in pieces/copë) and
 * the difference is shown live. Saving sets stock to the counted value and records
 * an adjustment movement for the difference.
 */
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Stack, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Btn, Card } from "@/components/ui-kit";
import { useColors } from "@/hooks/use-colors";
import {
  createInventoryDoc,
  fmt,
  num,
  stockInStore,
  todayStr,
  useStore,
} from "@/lib/store";

export default function InventoryDocScreen() {
  const router = useRouter();
  const colors = useColors();
  const { db, setDB } = useStore();

  const activeWarehouses = useMemo(
    () => (db.warehouses || []).filter((w) => w.status === "active"),
    [db.warehouses],
  );

  const [date] = useState(todayStr());
  const [warehouse, setWarehouse] = useState(activeWarehouses[0]?.name || db.stores?.[0] || "");
  const [search, setSearch] = useState("");
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.products
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q))
      .map((p) => ({
        name: p.name,
        system: stockInStore(p, warehouse),
        unit: p.units?.[0]?.name || "Copë",
      }));
  }, [db.products, warehouse, search]);

  const countedLines = useMemo(
    () =>
      Object.keys(counted)
        .filter((name) => counted[name] !== "" && counted[name] != null)
        .map((name) => ({ productName: name, unit: "Copë", countedQty: num(counted[name]) })),
    [counted],
  );

  const save = async () => {
    if (!warehouse) {
      Alert.alert("Gabim", "Zgjidh magazinën.");
      return;
    }
    if (!countedLines.length) {
      Alert.alert("Gabim", "Fut sasinë e numëruar për të paktën një artikull.");
      return;
    }
    setSaving(true);
    try {
      // Use each product's base unit so countedQty is interpreted in pieces.
      const lines = countedLines.map((l) => {
        const p = db.products.find((x) => x.name.toLowerCase() === l.productName.toLowerCase());
        return { productName: l.productName, unit: p?.units?.[0]?.name || "Copë", countedQty: l.countedQty };
      });
      const result = createInventoryDoc(db, { date, warehouse, lines });
      if (result.error) {
        Alert.alert("Nuk u ruajt dot", result.error);
        setSaving(false);
        return;
      }
      await setDB(result.db);
      Alert.alert("U ruajt", `Inventari ${result.doc?.no} u ruajt. Stoku u rregullua.`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Gabim", e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{ title: "Inventar Fizik", headerStyle: { backgroundColor: colors.primary }, headerTintColor: "#fff" }}
      />
      <ScreenContainer>
        <FlatList
          data={rows}
          keyExtractor={(r) => r.name}
          contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 100 }}
          ListHeaderComponent={
            <View style={{ gap: 10, marginBottom: 4 }}>
              <Card style={{ gap: 8 }}>
                <Text style={{ color: colors.foreground, fontWeight: "800" }}>Magazina</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {activeWarehouses.map((w) => {
                    const active = warehouse === w.name;
                    return (
                      <Pressable
                        key={w.id}
                        onPress={() => setWarehouse(w.name)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? colors.primary : "transparent",
                        }}
                      >
                        <Text style={{ color: active ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 13 }}>
                          {w.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Data: {date} · Sasia numërohet në copë
                </Text>
              </Card>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                }}
              >
                <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Kërko artikull..."
                  placeholderTextColor={colors.muted}
                  style={{ flex: 1, color: colors.foreground, paddingVertical: 10 }}
                />
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const raw = counted[item.name];
            const has = raw !== "" && raw != null;
            const diff = has ? num(raw) - item.system : 0;
            return (
              <Card style={{ gap: 6 }}>
                <Text style={{ color: colors.foreground, fontWeight: "700" }}>{item.name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ color: colors.muted, fontSize: 13, width: 90 }}>
                    Sistemi: {fmt(item.system)}
                  </Text>
                  <TextInput
                    value={raw ?? ""}
                    onChangeText={(v) => setCounted((prev) => ({ ...prev, [item.name]: v }))}
                    keyboardType="numeric"
                    placeholder="Numëruar"
                    placeholderTextColor={colors.muted}
                    style={{
                      flex: 1,
                      color: colors.foreground,
                      fontSize: 16,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                    }}
                  />
                </View>
                {has ? (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: diff === 0 ? colors.muted : diff > 0 ? colors.success : colors.error,
                    }}
                  >
                    Diferenca: {diff > 0 ? "+" : ""}
                    {fmt(diff)} copë
                  </Text>
                ) : null}
              </Card>
            );
          }}
          ListEmptyComponent={
            <Text style={{ color: colors.muted, textAlign: "center", padding: 20 }}>Asnjë artikull.</Text>
          }
          ListFooterComponent={
            <View style={{ marginTop: 12 }}>
              <Btn
                title={saving ? "Duke ruajtur..." : "Ruaj Inventarin"}
                icon="checkmark"
                onPress={save}
                fullWidth
              />
            </View>
          }
        />
      </ScreenContainer>
    </>
  );
}
