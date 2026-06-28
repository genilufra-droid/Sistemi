import React from "react";
import { Alert, FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Header, Btn, Field, Toggle } from "@/components/ui-kit";
import { router } from "expo-router";
import { applyStockDelta, fmt, nextStockAdjId, num, stockInStore, todayStr, unitCoef, useStore, type StockAdjustment } from "@/lib/store";

export default function StockAdjustmentScreen() {
  const colors = useColors();
  const { db, setDB } = useStore();
  const [picker, setPicker] = React.useState(false);
  const [productName, setProductName] = React.useState<string>("");
  const product = db.products.find((p) => p.name === productName);
  const [unit, setUnit] = React.useState("Cope");
  const [qty, setQty] = React.useState("");
  const [type, setType] = React.useState<"add" | "reduce">("add");
  const [store, setStore] = React.useState<string>(db.stores[0] || "Magazina kryesore");
  const [date, setDate] = React.useState(todayStr());
  const [details, setDetails] = React.useState("");
  const [price, setPrice] = React.useState("");

  React.useEffect(() => {
    if (product) {
      setUnit(product.units[0]?.name || "Cope");
      setPrice(String(product.buyPiece));
    }
  }, [productName]);

  const apply = async () => {
    if (!product) {
      Alert.alert("Artikull", "Zgjidh nje artikull.");
      return;
    }
    if (!num(qty)) {
      Alert.alert("Sasia", "Vendos sasine.");
      return;
    }
    const coef = unitCoef(product, unit);
    const total = num(qty) * coef;
    if (type === "reduce" && stockInStore(product, store) + 0.0001 < total) {
      Alert.alert(
        "Stok i pamjaftueshëm",
        `Magazina "${store}" ka ${fmt(stockInStore(product, store))} copë, ndërsa kërkon të heqësh ${fmt(total)} copë.`,
      );
      return;
    }
    const newAdj: StockAdjustment = {
      id: nextStockAdjId(db),
      date,
      store,
      product: product.name,
      unit,
      qty: num(qty),
      type,
      price: num(price),
      details,
    };
    const delta = type === "add" ? total : -total;
    const products = db.products.map((p) =>
      p.name === product.name ? applyStockDelta(p, store, delta) : p,
    );
    await setDB({ ...db, products, stockAdjustments: [...db.stockAdjustments, newAdj] });
    Alert.alert("OK", "Rregullimi u ruajt.");
    setQty("");
    setDetails("");
  };

  return (
    <ScreenContainer>
      <Header title="Rregullim stoku" back={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
        <Toggle
          value={type}
          onChange={(v) => setType(v as any)}
          options={[
            { value: "add", label: "Shto stok" },
            { value: "reduce", label: "Ul stok" },
          ]}
        />
        <View style={{ height: 12 }} />
        {db.stores.length > 1 ? (
          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Magazina</Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {db.stores.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setStore(s)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: s === store ? colors.primary : colors.border,
                    backgroundColor: s === store ? "#dceffd" : colors.surface,
                  }}
                >
                  <Text style={{ color: s === store ? colors.primary : colors.foreground, fontWeight: "700", fontSize: 12 }}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        <Pressable
          onPress={() => setPicker(true)}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 8,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 12 }}>Artikulli</Text>
          <Text style={{ color: productName ? colors.foreground : colors.muted, fontSize: 16, fontWeight: "800", marginTop: 4 }}>
            {productName || "Zgjidh artikull"}
          </Text>
          {product ? (
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
              Stok te "{store}": {fmt(stockInStore(product, store))} • Cmimi i blerjes: {fmt(product.buyPiece)}
            </Text>
          ) : null}
        </Pressable>
        <Field label="Data" value={date} onChangeText={setDate} placeholder="2026-01-01" />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Field containerStyle={{ flex: 1 }} label="Sasia" keyboardType="numeric" value={qty} onChangeText={setQty} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Njesia</Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {(product?.units || [{ name: "Cope", coef: 1 }]).map((u) => (
                <Pressable
                  key={u.name}
                  onPress={() => setUnit(u.name)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: u.name === unit ? colors.primary : colors.border,
                    backgroundColor: u.name === unit ? "#dceffd" : colors.surface,
                  }}
                >
                  <Text style={{ color: u.name === unit ? colors.primary : colors.foreground, fontWeight: "700", fontSize: 12 }}>
                    {u.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
        <Field label="Cmimi/copa" keyboardType="numeric" value={price} onChangeText={setPrice} />
        <Field label="Pershkrim" value={details} onChangeText={setDetails} placeholder="(Opsionale)" />
        <Btn fullWidth title="Apliko" onPress={apply} />

        <Text style={{ marginTop: 18, fontWeight: "900", color: colors.foreground }}>Historiku</Text>
        {db.stockAdjustments
          .slice()
          .reverse()
          .slice(0, 50)
          .map((row) => (
            <View
              key={row.id}
              style={{
                marginTop: 6,
                backgroundColor: colors.surface,
                padding: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "800" }}>{row.product}</Text>
                <Text style={{ fontWeight: "800", color: row.type === "add" ? colors.success : colors.error }}>
                  {row.type === "add" ? "+" : "-"}
                  {fmt(row.qty)} {row.unit}
                </Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                {row.date} {row.details ? `• ${row.details}` : ""}
              </Text>
            </View>
          ))}
      </ScrollView>

      {picker ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "center",
            padding: 18,
          }}
        >
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, maxHeight: 480 }}>
            <Text style={{ fontWeight: "900", fontSize: 16, marginBottom: 8 }}>Zgjidh artikullin</Text>
            <FlatList
              data={db.products}
              keyExtractor={(p) => String(p.id)}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setProductName(item.name);
                    setPicker(false);
                  }}
                  style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border }}
                >
                  <Text style={{ fontWeight: "800" }}>{item.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Stok: {fmt(item.stock)}</Text>
                </Pressable>
              )}
            />
            <Pressable onPress={() => setPicker(false)} style={{ alignSelf: "flex-end", padding: 12 }}>
              <Text style={{ color: colors.primary, fontWeight: "800" }}>Mbyll</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScreenContainer>
  );
}
