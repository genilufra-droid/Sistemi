/**
 * Stores (Magazina) screen — manage multiple inventory locations.
 * Inspired by Vyapar's Stores module, redesigned for Sistemi Genit.
 */
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Stack, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Badge, Btn, Card } from "@/components/ui-kit";
import { useColors } from "@/hooks/use-colors";
import { fmt, useStore } from "@/lib/store";

export default function StoresScreen() {
  const router = useRouter();
  const colors = useColors();
  const { db, setDB } = useStore();
  const [newStore, setNewStore] = useState("");
  const [adding, setAdding] = useState(false);

  const summary = useMemo(() => {
    const map = new Map<string, { products: number; units: number }>();
    for (const s of db.stores) map.set(s, { products: 0, units: 0 });
    for (const p of db.products) {
      const key = p.store || db.stores[0] || "—";
      const cur = map.get(key) || { products: 0, units: 0 };
      map.set(key, { products: cur.products + 1, units: cur.units + (p.stock || 0) });
    }
    return [...map.entries()].map(([store, v]) => ({ store, ...v }));
  }, [db.stores, db.products]);

  const addStore = async () => {
    const name = newStore.trim();
    if (!name) return;
    if (db.stores.includes(name)) {
      Alert.alert("Ekziston", "Kjo magazinë ekziston tashmë.");
      return;
    }
    await setDB((prev) => ({ ...prev, stores: [...prev.stores, name] }));
    setNewStore("");
    setAdding(false);
  };

  const removeStore = (name: string) => {
    if (db.stores.length === 1) {
      Alert.alert("Nuk lejohet", "Duhet të kesh të paktën një magazinë.");
      return;
    }
    const inUse = db.products.some((p) => p.store === name);
    if (inUse) {
      Alert.alert(
        "Magazina po përdoret",
        "Kjo magazinë ka artikuj. Lëviz ose ndrysho artikujt përpara se ta fshish.",
      );
      return;
    }
    Alert.alert("Fshi magazinën", `Të fshihet "${name}"?`, [
      { text: "Anulo", style: "cancel" },
      {
        text: "Fshi",
        style: "destructive",
        onPress: () =>
          setDB((prev) => ({ ...prev, stores: prev.stores.filter((s) => s !== name) })),
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Magazinat",
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: "#fff",
        }}
      />
      <ScreenContainer>
        <View style={{ padding: 12, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn
              title="Transfero stok"
              icon="arrow.up.right"
              onPress={() => router.push("/store-transfer" as any)}
              fullWidth
            />
          </View>

          {adding ? (
            <Card>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Emri i magazinës së re</Text>
              <TextInput
                value={newStore}
                onChangeText={setNewStore}
                placeholder="P.sh. Magazina Lushnje"
                placeholderTextColor={colors.muted}
                autoFocus
                style={{
                  color: colors.foreground,
                  fontSize: 16,
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  marginBottom: 8,
                }}
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Btn title="Anulo" variant="ghost" onPress={() => { setAdding(false); setNewStore(""); }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Btn title="Ruaj" onPress={addStore} />
                </View>
              </View>
            </Card>
          ) : (
            <Btn title="Shto magazinë" icon="plus" variant="soft" onPress={() => setAdding(true)} />
          )}
        </View>

        <FlatList
          data={summary}
          keyExtractor={(s) => s.store}
          contentContainerStyle={{ padding: 12, paddingTop: 0, gap: 10, paddingBottom: 80 }}
          renderItem={({ item, index }) => (
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>
                      {item.store}
                    </Text>
                    {index === 0 ? <Badge tone="paid">Kryesore</Badge> : null}
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {item.products} artikuj · {fmt(item.units)} njësi në stok
                  </Text>
                </View>
                <Pressable
                  onPress={() => removeStore(item.store)}
                  hitSlop={10}
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 0.7, padding: 4 })}
                >
                  <IconSymbol name="trash.fill" size={18} color={colors.error} />
                </Pressable>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <Text style={{ color: colors.muted, textAlign: "center", padding: 20 }}>
              Asnjë magazinë e konfiguruar.
            </Text>
          }
        />
      </ScreenContainer>
    </>
  );
}
