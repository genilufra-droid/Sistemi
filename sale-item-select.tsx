import React from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Header, Btn, Field } from "@/components/ui-kit";
import { router, useLocalSearchParams } from "expo-router";
import { activePrice, fmt, num, unitCoef, useStore, priceForList, formatStockUnits, getLastClientPrices } from "@/lib/store";
import { setDraft, getDraft } from "@/lib/sale-draft";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function SaleItemSelectScreen() {
  const colors = useColors();
  const { db } = useStore();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = (params.kind || "sale") as "sale" | "purchase";
  const [q, setQ] = React.useState("");
  const [picked, setPicked] = React.useState<number | null>(null);

  const filtered = db.products.filter(
    (p) =>
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      (p.code || "").toLowerCase().includes(q.toLowerCase()),
  );

  const product = picked ? db.products.find((p) => p.id === picked) : null;
  const [unit, setUnit] = React.useState("Cope");
  const [qty, setQty] = React.useState("1");
  const [freeQty, setFreeQty] = React.useState("0");
  const [rate, setRate] = React.useState("0");
  const listNames = db.company.priceListNames || [];
  // Default price list = the selected customer's default (sale only)
  const customerName = getDraft().party;
  const customer = db.customers.find((c) => c.name === customerName);
  const [priceList, setPriceList] = React.useState<number>(customer?.defaultPriceList ?? 0);

  // Last 5 prices used for this client + product (smart suggestions)
  const lastPrices = getLastClientPrices(db, customerName || "", product?.name || "");

  /**
   * Per-piece base price for the current product/price-list/kind.
   * Sales prefer the selected price list (fallback to active sale price);
   * purchases use the active buy price.
   */
  const piecePriceFor = React.useCallback(
    (prod: typeof product, list: number): number => {
      if (!prod) return 0;
      const ap = activePrice(db, prod.name, getDraft().date);
      if (kind === "sale") {
        const listPrice = priceForList(prod, list);
        return listPrice > 0 ? listPrice : ap.salePiece;
      }
      return ap.buyPiece;
    },
    [db, kind],
  );

  React.useEffect(() => {
    if (product) {
      const firstUnit = product.units[0]?.name || "Cope";
      setUnit(firstUnit);
      // Auto-fill the price for the FIRST (base) unit on open.
      const piece = piecePriceFor(product, priceList);
      const coef = unitCoef(product, firstUnit);
      setRate(String(Math.round(piece * coef)));
      setQty("1");
      setFreeQty("0");
    }
  }, [picked]);

  // When the user changes the price list OR the unit while an item is open,
  // automatically recompute and fill the price for the SELECTED unit.
  // Price per unit = piece price × unit coefficient.
  // e.g. piece price 25, unit "Koli" (coef 12) => 25 × 12 = 300 per Koli.
  React.useEffect(() => {
    if (!product) return;
    const piece = piecePriceFor(product, priceList);
    const coef = unitCoef(product, unit);
    setRate(String(Math.round(piece * coef))); // round to whole number
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceList, unit]);

  const coef = product ? unitCoef(product, unit) : 1;
  // `rate` is now per SELECTED unit, so the line total is simply qty × rate.
  const lineTotal = num(qty) * num(rate);
  const ap = product ? activePrice(db, product.name, getDraft().date) : { buyPiece: 0, salePiece: 0 };
  // Cost stays computed in base units: (qty + free) × coef × buy-price-per-piece.
  const lineCost = (num(qty) + num(freeQty)) * coef * ap.buyPiece;

  const add = () => {
    if (!product) return;
    const item = {
      productName: product.name,
      qty: num(qty),
      freeQty: num(freeQty),
      unit,
      rate: num(rate),
      buyRate: ap.buyPiece,
      total: lineTotal,
      cost: lineCost,
      priceList: kind === "sale" ? priceList : undefined,
    };
    setDraft((p) => ({ ...p, items: [...p.items, item] }));
    setPicked(null);
    router.back();
  };

  return (
    <ScreenContainer>
      <Header
        title={picked ? product?.name || "Artikull" : "Zgjidh artikull"}
        back={() => (picked ? setPicked(null) : router.back())}
      />

      {!picked ? (
        <>
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
                placeholder="Kerko artikull"
                placeholderTextColor={colors.muted}
                style={{ flex: 1, paddingVertical: 12, color: colors.foreground }}
              />
            </View>
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(p) => String(p.id)}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setPicked(item.id)}
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
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    Stok: {formatStockUnits(item, item.stock)}
                  </Text>
                  <Text style={{ color: colors.foreground, fontWeight: "800" }}>{fmt(item.salePiece)}</Text>
                </View>
              </Pressable>
            )}
          />
        </>
      ) : (
        <View style={{ padding: 12 }}>
          <Field label="Sasia" keyboardType="numeric" value={qty} onChangeText={setQty} />
          <Field label="Sasi falas" keyboardType="numeric" value={freeQty} onChangeText={setFreeQty} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(product?.units || [{ name: "Cope", coef: 1 }]).map((u) => (
              <Pressable
                key={u.name}
                onPress={() => setUnit(u.name)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: u.name === unit ? colors.primary : colors.border,
                  backgroundColor: u.name === unit ? "#dceffd" : colors.surface,
                }}
              >
                <Text style={{ color: u.name === unit ? colors.primary : colors.foreground, fontWeight: "800" }}>
                  {u.name} ({u.coef})
                </Text>
              </Pressable>
            ))}
          </View>
          {kind === "sale" ? (
            <View style={{ marginBottom: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginBottom: 6 }}>
                Lista e cmimit
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {Array.from({ length: 10 }).map((_, i) => {
                  const has = (product?.prices || [])[i] > 0 || i === 0;
                  if (!has) return null;
                  const active = priceList === i;
                  return (
                    <Pressable
                      key={i}
                      onPress={() => setPriceList(i)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? "#dceffd" : colors.surface,
                      }}
                    >
                      <Text style={{ color: active ? colors.primary : colors.foreground, fontWeight: "700", fontSize: 12 }}>
                        {listNames[i] || `Lista ${i + 1}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          <View>
            <Field label={`Cmimi (${kind === "sale" ? "shitje" : "blerje"})`} keyboardType="numeric" value={rate} onChangeText={setRate} />
            {product ? (() => {
              const last5 = (kind === "sale" ? db.invoices : db.purchases)
                .flatMap((doc: any) =>
                  (doc.items || [])
                    .filter((it: any) => it.productName === product.name)
                    .map((it: any) => ({
                      date: doc.date,
                      party: kind === "sale" ? doc.customer : doc.supplier,
                      qty: it.qty,
                      unit: it.unit,
                      rate: it.rate,
                    })),
                )
                .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))
                .slice(0, 5);
              if (last5.length === 0) return null;
              return (
                <View style={{ marginTop: 4, marginBottom: 8 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginBottom: 6 }}>
                    5 çmimet e fundit
                  </Text>
                  {last5.map((p: any, idx: number) => (
                    <Pressable
                      key={idx}
                      onPress={() => setRate(String(p.rate))}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        backgroundColor: colors.surface,
                        padding: 8,
                        borderRadius: 6,
                        marginBottom: 4,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 12 }}>
                        {p.date} · {p.party || "—"}
                      </Text>
                      <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 12 }}>
                        {fmt(p.rate)} / {p.unit}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              );
            })() : null}
          </View>
          {/* Smart price suggestions from last 5 sales to this client */}
          {lastPrices.length > 0 && (
            <View style={{ marginTop: 8, padding: 12, backgroundColor: '#f0f9ff', borderRadius: 10, borderWidth: 1, borderColor: '#bae6fd' }}>
              <Text style={{ fontWeight: '700', color: '#0369a1', marginBottom: 6 }}>💰 Çmimet e fundit për këtë klient:</Text>
              {lastPrices.map((p, i) => (
                <Pressable key={i} onPress={() => setRate(String(p.price))} style={{ paddingVertical: 5 }}>
                  <Text style={{ color: '#0ea5e9', fontWeight: '600' }}>
                    {p.unit} → {fmt(p.price)} lek • {p.date}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <View
            style={{
              backgroundColor: "#f0f9ff",
              padding: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#cfe6f8",
              marginTop: 8,
            }}
          >
            <Text style={{ color: colors.muted, fontWeight: "700" }}>Vlera e rreshtit</Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: colors.primary }}>{fmt(lineTotal)}</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Kosto: {fmt(lineCost)}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            <Btn title="Anulo" variant="ghost" onPress={() => setPicked(null)} />
            <Btn title="Shto rreshtin" onPress={add} style={{ flex: 1 }} />
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}
