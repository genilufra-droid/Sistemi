/**
 * Warehouses (Magazinat) — Phase 1 multi-warehouse management.
 * List / search / add / edit warehouses, toggle active⇄inactive, view per-warehouse
 * stock summary, and jump to stock transfer.
 */
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Badge, Btn, Card } from "@/components/ui-kit";
import { useColors } from "@/hooks/use-colors";
import {
  createWarehouse,
  fmt,
  setWarehouseStatus,
  stockInStore,
  totalStock,
  updateWarehouse,
  useStore,
  WAREHOUSE_TYPE_LABELS,
  type Warehouse,
  type WarehouseType,
} from "@/lib/store";

const WH_TYPES: WarehouseType[] = ["main", "van", "branch", "reserve"];

export default function WarehousesScreen() {
  const router = useRouter();
  const colors = useColors();
  const { db, setDB } = useStore();

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [fName, setFName] = useState("");
  const [fType, setFType] = useState<WarehouseType>("branch");
  const [fAddress, setFAddress] = useState("");
  const [fNotes, setFNotes] = useState("");

  // Per-warehouse stock summary (products with stock + total base units).
  const summary = useMemo(() => {
    const m = new Map<string, { products: number; units: number }>();
    (db.warehouses || []).forEach((w) => m.set(w.name, { products: 0, units: 0 }));
    db.products.forEach((p) => {
      (db.warehouses || []).forEach((w) => {
        const q = stockInStore(p, w.name);
        if (q !== 0) {
          const cur = m.get(w.name) || { products: 0, units: 0 };
          cur.products += 1;
          cur.units += q;
          m.set(w.name, cur);
        }
      });
    });
    return m;
  }, [db.warehouses, db.products]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (db.warehouses || []).filter(
      (w) => !q || w.name.toLowerCase().includes(q) || (w.address || "").toLowerCase().includes(q),
    );
  }, [db.warehouses, search]);

  const openAdd = () => {
    setEditing(null);
    setFName("");
    setFType("branch");
    setFAddress("");
    setFNotes("");
    setShowForm(true);
  };

  const openEdit = (w: Warehouse) => {
    setEditing(w);
    setFName(w.name);
    setFType((w.type as WarehouseType) || "branch");
    setFAddress(w.address || "");
    setFNotes(w.notes || "");
    setShowForm(true);
  };

  const saveForm = async () => {
    try {
      if (editing) {
        await setDB((prev) =>
          updateWarehouse(prev, editing.id, { name: fName, type: fType, address: fAddress, notes: fNotes }),
        );
      } else {
        await setDB((prev) =>
          createWarehouse(prev, { name: fName, type: fType, address: fAddress, notes: fNotes }),
        );
      }
      setShowForm(false);
    } catch (e: any) {
      Alert.alert("Gabim", e?.message || String(e));
    }
  };

  const toggleStatus = (w: Warehouse) => {
    const next = w.status === "active" ? "inactive" : "active";
    if (next === "inactive") {
      const active = (db.warehouses || []).filter((x) => x.status === "active");
      if (active.length <= 1) {
        Alert.alert("Nuk lejohet", "Duhet të kesh të paktën një magazinë aktive.");
        return;
      }
    }
    setDB((prev) => setWarehouseStatus(prev, w.id, next));
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
            <View style={{ flex: 1 }}>
              <Btn title="Shto magazinë" icon="plus" onPress={openAdd} fullWidth />
            </View>
            <View style={{ flex: 1 }}>
              <Btn
                title="Transfero stok"
                icon="arrow.up.right"
                variant="soft"
                onPress={() => router.push("/store-transfer" as any)}
                fullWidth
              />
            </View>
          </View>

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
              placeholder="Kërko magazinë..."
              placeholderTextColor={colors.muted}
              style={{ flex: 1, color: colors.foreground, paddingVertical: 10 }}
            />
          </View>

          {showForm ? (
            <Card>
              <Text style={{ color: colors.foreground, fontWeight: "800", marginBottom: 6 }}>
                {editing ? "Ndrysho magazinën" : "Magazinë e re"}
              </Text>
              <LabeledInput label="Emri *" value={fName} onChangeText={setFName} placeholder="P.sh. Magazina Lushnje" />
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Lloji</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {WH_TYPES.map((t) => {
                  const active = fType === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => setFType(t)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primary : "transparent",
                      }}
                    >
                      <Text style={{ color: active ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 13 }}>
                        {WAREHOUSE_TYPE_LABELS[t]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <LabeledInput label="Adresa" value={fAddress} onChangeText={setFAddress} placeholder="(Opsionale)" />
              <LabeledInput label="Shënim" value={fNotes} onChangeText={setFNotes} placeholder="(Opsionale)" />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                <View style={{ flex: 1 }}>
                  <Btn title="Anulo" variant="ghost" onPress={() => setShowForm(false)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Btn title="Ruaj" onPress={saveForm} />
                </View>
              </View>
            </Card>
          ) : null}
        </View>

        <FlatList
          data={list}
          keyExtractor={(w) => String(w.id)}
          contentContainerStyle={{ padding: 12, paddingTop: 0, gap: 10, paddingBottom: 80 }}
          renderItem={({ item }) => {
            const s = summary.get(item.name) || { products: 0, units: 0 };
            return (
              <Card>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>{item.name}</Text>
                      <Badge tone="neutral">{WAREHOUSE_TYPE_LABELS[(item.type as WarehouseType) || "branch"]}</Badge>
                      {item.status === "active" ? (
                        <Badge tone="paid">Aktive</Badge>
                      ) : (
                        <Badge tone="open">Joaktive</Badge>
                      )}
                    </View>
                    {item.address ? (
                      <Text style={{ color: colors.muted, fontSize: 12 }}>{item.address}</Text>
                    ) : null}
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {s.products} artikuj · {fmt(s.units)} copë në stok
                    </Text>
                    {item.notes ? (
                      <Text style={{ color: colors.muted, fontSize: 11, fontStyle: "italic" }}>{item.notes}</Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                    <Pressable onPress={() => openEdit(item)} hitSlop={8}>
                      <IconSymbol name="pencil" size={18} color={colors.primary} />
                    </Pressable>
                    <Pressable onPress={() => toggleStatus(item)} hitSlop={8}>
                      <IconSymbol
                        name={item.status === "active" ? "pause.circle.fill" : "play.circle.fill"}
                        size={20}
                        color={item.status === "active" ? colors.muted : colors.success}
                      />
                    </Pressable>
                  </View>
                </View>
              </Card>
            );
          }}
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

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={{
          color: colors.foreground,
          fontSize: 16,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      />
    </View>
  );
}
