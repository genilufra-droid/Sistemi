/**
 * Shared form for Fletë Hyrje (inbound) and Fletë Dalje (outbound) documents.
 * Pick warehouse, add product lines (product + unit + qty), preview the base-unit
 * conversion (e.g. "10 Koli = 120 copë"), and save. Outbound blocks on insufficient
 * stock (handled by the store helper).
 */
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Btn, Card } from "@/components/ui-kit";
import { useColors } from "@/hooks/use-colors";
import {
  createInboundDoc,
  createOutboundDoc,
  fmt,
  num,
  stockInStore,
  todayStr,
  unitCoef,
  useStore,
  type Product,
  type WarehouseDocLineInput,
} from "@/lib/store";

type LineDraft = WarehouseDocLineInput & { _k: string };

export function WarehouseDocForm({ kind }: { kind: "inbound" | "outbound" }) {
  const router = useRouter();
  const colors = useColors();
  const { db, setDB } = useStore();

  const title = kind === "inbound" ? "Fletë Hyrje" : "Fletë Dalje";

  const activeWarehouses = useMemo(
    () => (db.warehouses || []).filter((w) => w.status === "active"),
    [db.warehouses],
  );

  const [date] = useState(todayStr());
  const [warehouse, setWarehouse] = useState(activeWarehouses[0]?.name || db.stores?.[0] || "");
  const [reason, setReason] = useState("");
  const [partyName, setPartyName] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [authorizedPerson, setAuthorizedPerson] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const productResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [] as Product[];
    return db.products.filter((p) => p.name.toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q)).slice(0, 8);
  }, [db.products, search]);

  const addLine = (p: Product) => {
    const defaultUnit = p.units?.[0]?.name || "Copë";
    setLines((prev) => [
      ...prev,
      { _k: `${p.id}-${Date.now()}`, productName: p.name, unit: defaultUnit, qty: 1 },
    ]);
    setSearch("");
  };

  const updateLine = (k: string, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l) => (l._k === k ? { ...l, ...patch } : l)));

  const removeLine = (k: string) => setLines((prev) => prev.filter((l) => l._k !== k));

  const productOf = (name: string) => db.products.find((p) => p.name.toLowerCase() === name.toLowerCase());

  const save = async () => {
    if (!warehouse) {
      Alert.alert("Gabim", "Zgjidh magazinën.");
      return;
    }
    const validLines = lines.filter((l) => num(l.qty) > 0);
    if (!validLines.length) {
      Alert.alert("Gabim", "Shto të paktën një artikull me sasi.");
      return;
    }
    setSaving(true);
    try {
      let result;
      const input = {
        date,
        warehouse,
        reason: reason.trim() || undefined,
        customerName: kind === "outbound" ? partyName.trim() || undefined : undefined,
        supplierName: kind === "inbound" ? partyName.trim() || undefined : undefined,
        destinationAddress: destinationAddress.trim() || undefined,
        authorizedPerson: authorizedPerson.trim() || undefined,
        vehicle: vehicle.trim() || undefined,
        serialNo: serialNo.trim() || undefined,
        lines: validLines.map((l) => ({ productName: l.productName, unit: l.unit, qty: num(l.qty) })),
      };
      if (kind === "inbound") {
        result = createInboundDoc(db, input);
      } else {
        result = createOutboundDoc(db, input);
      }
      if (result.error) {
        Alert.alert("Nuk u ruajt dot", result.error);
        setSaving(false);
        return;
      }
      await setDB(result.db);
      Alert.alert("U ruajt", `${title} ${result.doc?.no} u ruajt me sukses.`, [
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
        options={{ title, headerStyle: { backgroundColor: colors.primary }, headerTintColor: "#fff" }}
      />
      <ScreenContainer>
        <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
          {/* Warehouse selector */}
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
            <Text style={{ color: colors.muted, fontSize: 12 }}>Data: {date}</Text>
          </Card>

          {/* Product search */}
          <Card style={{ gap: 8 }}>
            <Text style={{ color: colors.foreground, fontWeight: "800" }}>Shto artikull</Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: colors.background,
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
            {productResults.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => addLine(p)}
                style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>{p.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Stok në {warehouse || "—"}: {fmt(stockInStore(p, warehouse))} copë
                </Text>
              </Pressable>
            ))}
          </Card>

          {/* Lines */}
          {lines.map((l) => {
            const p = productOf(l.productName);
            const coef = unitCoef(p, l.unit);
            const base = num(l.qty) * coef;
            const avail = p ? stockInStore(p, warehouse) : 0;
            const insufficient = kind === "outbound" && base > avail + 0.0001;
            return (
              <Card key={l._k} style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: colors.foreground, fontWeight: "700", flex: 1 }}>{l.productName}</Text>
                  <Pressable onPress={() => removeLine(l._k)} hitSlop={8}>
                    <IconSymbol name="trash" size={18} color={colors.error} />
                  </Pressable>
                </View>
                {/* Unit chips */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {(p?.units || [{ name: "Copë", coef: 1 }]).map((u) => {
                    const active = l.unit === u.name;
                    return (
                      <Pressable
                        key={u.name}
                        onPress={() => updateLine(l._k, { unit: u.name })}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? colors.primary : "transparent",
                        }}
                      >
                        <Text style={{ color: active ? "#fff" : colors.foreground, fontSize: 12 }}>{u.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>Sasia:</Text>
                  <TextInput
                    value={String(l.qty)}
                    onChangeText={(v) => updateLine(l._k, { qty: num(v) })}
                    keyboardType="numeric"
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
                <Text style={{ color: insufficient ? colors.error : colors.muted, fontSize: 12 }}>
                  {num(l.qty)} {l.unit} = {fmt(base)} copë
                  {kind === "outbound" ? `  ·  Në stok: ${fmt(avail)} copë` : ""}
                  {insufficient ? "  ·  STOK I PAMJAFTUESHËM" : ""}
                </Text>
              </Card>
            );
          })}

          <Card style={{ gap: 10 }}>
            <Text style={{ color: colors.foreground, fontWeight: "800" }}>Detaje Dokumenti</Text>
            
            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{kind === "inbound" ? "Furnitori" : "Marrësi"}</Text>
              <TextInput
                value={partyName}
                onChangeText={setPartyName}
                placeholder={kind === "inbound" ? "Emri i furnitorit..." : "Emri i marrësit..."}
                placeholderTextColor={colors.muted}
                style={{ color: colors.foreground, fontSize: 15, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
              />
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Adresa ku shkon malli</Text>
              <TextInput
                value={destinationAddress}
                onChangeText={setDestinationAddress}
                placeholder="Adresa e destinacionit..."
                placeholderTextColor={colors.muted}
                style={{ color: colors.foreground, fontSize: 15, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
              />
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Personi i Autorizuar</Text>
              <TextInput
                value={authorizedPerson}
                onChangeText={setAuthorizedPerson}
                placeholder="Emri, mbiemri..."
                placeholderTextColor={colors.muted}
                style={{ color: colors.foreground, fontSize: 15, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
              />
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Mjeti i transportit</Text>
              <TextInput
                value={vehicle}
                onChangeText={setVehicle}
                placeholder="Lloji e targa..."
                placeholderTextColor={colors.muted}
                style={{ color: colors.foreground, fontSize: 15, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
              />
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Nr. Reference / Seria</Text>
              <TextInput
                value={serialNo}
                onChangeText={setSerialNo}
                placeholder="Referenca..."
                placeholderTextColor={colors.muted}
                style={{ color: colors.foreground, fontSize: 15, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
              />
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Arsyeja / Shënim</Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder={kind === "inbound" ? "P.sh. furnizim, kthim nga klienti..." : "P.sh. dëmtim, mostër, humbje..."}
                placeholderTextColor={colors.muted}
                style={{ color: colors.foreground, fontSize: 15, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
              />
            </View>
          </Card>

          <Btn title={saving ? "Duke ruajtur..." : `Ruaj ${title}`} icon="checkmark" onPress={save} fullWidth />
        </ScrollView>
      </ScreenContainer>
    </>
  );
}
