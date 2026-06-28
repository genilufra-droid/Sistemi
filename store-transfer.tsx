/**
 * Store Transfer (Transfero stok) — move stock between two stores.
 */
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { Btn, Card } from "@/components/ui-kit";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import {
  createTransfer,
  fmt,
  num,
  stockInStore,
  todayStr,
  useStore,
} from "@/lib/store";
import type { Transfer } from "@/lib/store";
import { PrintPreview } from "@/components/print-preview";
import { transferToPrintable } from "@/lib/print-templates";

export default function StoreTransferScreen() {
  const router = useRouter();
  const colors = useColors();
  const { db, setDB } = useStore();

  const [date, setDate] = useState(todayStr());
  const [fromStore, setFromStore] = useState(db.stores[0] || "");
  const [toStore, setToStore] = useState(db.stores[1] || db.stores[0] || "");
  const [productName, setProductName] = useState(db.products[0]?.name || "");
  const [unit, setUnit] = useState(db.products[0]?.units[0]?.name || "Copë");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [previewTransfer, setPreviewTransfer] = useState<Transfer | null>(null);

  const product = useMemo(
    () => db.products.find((p) => p.name === productName),
    [productName, db.products],
  );

  const recentTransfers = useMemo(
    () => [...(db.transfers || [])].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 8),
    [db.transfers],
  );

  const save = async () => {
    const res = createTransfer(db, {
      date,
      fromWarehouse: fromStore,
      toWarehouse: toStore,
      product: productName,
      unit,
      qty: num(qty),
      note,
    });
    if (res.error) {
      Alert.alert("Gabim", res.error);
      return;
    }
    await setDB(res.db);
    Alert.alert("Sukses", `Transferimi ${res.transfer?.transferNo} u regjistrua.`);
    router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Transfero stok",
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: "#fff",
        }}
      />
      <ScreenContainer>
        <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}>
          <Card>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Data</Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              style={{
                color: colors.foreground,
                fontSize: 16,
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            />
          </Card>

          <ChipPicker
            label="Nga magazina"
            options={db.stores}
            value={fromStore}
            onChange={setFromStore}
          />
          <ChipPicker
            label="Drejt magazinës"
            options={db.stores}
            value={toStore}
            onChange={setToStore}
          />

          <ChipPicker
            label="Artikulli"
            options={db.products.map((p) => p.name)}
            value={productName}
            onChange={(name) => {
              setProductName(name);
              const p = db.products.find((x) => x.name === name);
              setUnit(p?.units[0]?.name || "Copë");
            }}
          />

          {product ? (
            <ChipPicker
              label="Njësia"
              options={product.units.map((u) => u.name)}
              value={unit}
              onChange={setUnit}
            />
          ) : null}

          <Card>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Sasia</Text>
            <TextInput
              value={qty}
              onChangeText={setQty}
              keyboardType="decimal-pad"
              style={{
                color: colors.foreground,
                fontSize: 22,
                fontWeight: "700",
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            />
            {product ? (
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
                Stok te "{fromStore}": {fmt(stockInStore(product, fromStore))} copë
              </Text>
            ) : null}
          </Card>

          <Card>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Shënim (opsional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="P.sh. transferim për pikën e re"
              placeholderTextColor={colors.muted}
              multiline
              style={{
                color: colors.foreground,
                fontSize: 15,
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                minHeight: 40,
              }}
            />
          </Card>

          <Btn title="Ruaj transferimin" onPress={save} />

          {recentTransfers.length > 0 ? (
            <View style={{ gap: 8, marginTop: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }}>
                Transferimet e fundit
              </Text>
              {recentTransfers.map((t) => (
                <Card key={t.id}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: colors.foreground, fontWeight: "600", flex: 1 }}>{t.product}</Text>
                    <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 12, marginRight: 10 }}>{t.transferNo}</Text>
                    <Pressable onPress={() => setPreviewTransfer(t)} hitSlop={8} style={{ padding: 4 }}>
                      <IconSymbol name="printer.fill" size={20} color={colors.primary} />
                    </Pressable>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    {t.date} · {fmt(t.qty)} {t.unit} ({fmt(t.pieces)} copë) · {t.fromWarehouse} → {t.toWarehouse}
                  </Text>
                  {t.note ? (
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{t.note}</Text>
                  ) : null}
                </Card>
              ))}
            </View>
          ) : null}
        </ScrollView>

        <PrintPreview
          visible={!!previewTransfer}
          onClose={() => setPreviewTransfer(null)}
          doc={previewTransfer ? transferToPrintable(previewTransfer, db.company) : null}
          company={db.company}
          defaultPaper="80"
        />
      </ScreenContainer>
    </>
  );
}

function ChipPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const colors = useColors();
  return (
    <Card>
      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {options.map((o) => (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: o === value ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: o === value ? colors.primary : colors.border,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              style={{
                color: o === value ? "#fff" : colors.foreground,
                fontWeight: "600",
                fontSize: 13,
              }}
            >
              {o}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </Card>
  );
}
