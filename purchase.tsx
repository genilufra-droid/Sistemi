import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Header, Btn, Field, Toggle } from "@/components/ui-kit";
import { router, useLocalSearchParams } from "expo-router";
import { useDraft, setDraft, resetDraft, getDraft } from "@/lib/sale-draft";
import {
  fmt,
  num,
  useStore,
  commitPurchaseInvoice,
  warehouseNames,
  currentSalesmanName,
  attachLocation,
  activeRoute,
  latestPurchaseForSupplier,
  copyLastSupplierPurchase,
  addUsualSupplierItems,
  type Purchase,
} from "@/lib/store";
import { captureLocation, geoToRoutePoint } from "@/lib/location";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function PurchaseScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // Lift the action bar clearly above the Android gesture/nav bar so the button is easy to tap.
  const footerPad = insets.bottom + 16;
  const { db, setDB } = useStore();
  const params = useLocalSearchParams<{ edit?: string }>();
  const draft = useDraft();
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (params.edit) {
      const inv = db.purchases.find((i) => String(i.no) === String(params.edit));
      if (inv) {
        setDraft({
          kind: "purchase",
          party: inv.supplier,
          store: inv.store || db.stores[0],
          date: inv.date,
          time: inv.time,
          mode: inv.mode,
          items: inv.items.map((it) => ({ ...it })),
          paid: inv.paid,
          paymentType: inv.paymentType || "Cash",
          roundOff: inv.roundOff,
          note: inv.note || "",
          no: inv.no,
          salesman: inv.salesmanName || inv.salesman || currentSalesmanName(db),
          autoInbound: inv.autoCreateInboundDoc !== false,
        });
        return;
      }
    }
    if (getDraft().kind !== "purchase" || getDraft().items.length === 0) {
      resetDraft("purchase", db.stores[0] || "");
      setDraft({ salesman: currentSalesmanName(db) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtotal = draft.items.reduce((s, it) => s + num(it.total), 0);
  const total = subtotal + num(draft.roundOff);
  const due = total - num(draft.paid);

  const removeItem = (idx: number) =>
    setDraft((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  // --- Smart Repeat (Blerje e shpejtë) -------------------------------------
  const lastPurchase = React.useMemo(
    () => (draft.party ? latestPurchaseForSupplier(db, draft.party) : null),
    [db, draft.party],
  );

  const copyLastPurchase = () => {
    if (!draft.party) return;
    const items = copyLastSupplierPurchase(db, draft.party);
    if (!items.length) {
      Alert.alert("Blerje e shpejtë", "Nuk u gjet blerje për kopjim.");
      return;
    }
    // Copy LINES only — fresh purchase no/date/time, paid 0, round-off 0, credit
    // mode. GPS/route/timestamp are NOT copied.
    setDraft((p) => ({ ...p, items, paid: 0, roundOff: 0, mode: "Me detyrim" }));
    Alert.alert("Blerje e shpejtë", `Blerja u kopjua me ${items.length} artikuj.`);
  };

  const addUsualPurchaseItems = () => {
    if (!draft.party) return;
    const add = addUsualSupplierItems(db, draft.party, draft.items);
    if (!add.length) {
      Alert.alert("Blerje e shpejtë", "Artikujt kryesorë janë tashmë në blerje (ose s'ka histori).");
      return;
    }
    setDraft((p) => ({ ...p, items: [...p.items, ...add] }));
    Alert.alert("Blerje e shpejtë", `U shtuan ${add.length} artikuj të zakonshëm.`);
  };

  const save = async () => {
    if (saving) return;
    if (!draft.party) {
      Alert.alert("Furnitor", "Zgjidh nje furnitor.");
      return;
    }
    if (!draft.store) {
      Alert.alert("Magazina", "Zgjidh magazinën për këtë blerje.");
      return;
    }
    if (draft.items.length === 0) {
      Alert.alert("Artikuj", "Shto te pakten nje artikull.");
      return;
    }

    setSaving(true);
    try {
      const editingNo = draft.no;
      const no = editingNo || db.nextPurchase || 1;
      let newPurchase: Purchase = {
        no,
        date: draft.date,
        time: draft.time,
        supplier: draft.party,
        store: draft.store || db.stores[0],
        mode: draft.mode,
        items: draft.items.map((it) => ({ ...it })),
        subtotal,
        roundOff: num(draft.roundOff),
        total,
        paid: num(draft.paid),
        due,
        paymentType: draft.paymentType,
        note: draft.note,
      };

      const nextDB = { ...db };

      // Salesman + GPS: capture location (if enabled) and attach to the purchase.
      const salesman = (draft.salesman || currentSalesmanName(db)).trim();
      const route = activeRoute(db);
      const geo =
        db.settings?.gpsEnabled !== false ? await captureLocation() : undefined;
      newPurchase = attachLocation(newPurchase, salesman, geo, route?.id);
      if (route) {
        const pt = geo ? geoToRoutePoint(geo) : null;
        if (pt) {
          nextDB.routeTracks = (nextDB.routeTracks || []).map((r) =>
            r.id === route.id ? { ...r, points: [...r.points, pt] } : r,
          );
        }
      }
      // Apply the stock effect exactly once. When the auto toggle is ON a
      // linked Fletë Hyrje is created (which adds stock); when OFF the legacy
      // path runs. Editing reverses the old effect first inside the helper.
      const res = commitPurchaseInvoice(nextDB, newPurchase, {
        autoInbound: !!draft.autoInbound,
        editingNo: editingNo || undefined,
      });
      if (res.error) {
        Alert.alert("Stok negativ", res.error);
        return;
      }
      await setDB(res.db);
      resetDraft("purchase", db.stores[0] || "");
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <Header
        title={draft.no ? `Blerje #${draft.no}` : "Blerje"}
        back={() => router.back()}
        right={
          <Toggle
            value={draft.mode}
            options={[
              { value: "Me detyrim", label: "Me detyrim" },
              { value: "Me arke", label: "Me arke" } as any,
            ]}
            onChange={(v) => setDraft({ mode: v as any })}
          />
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 200 + footerPad }}>
        <View style={{ flexDirection: "row", gap: 8, padding: 12 }}>
          <Field
            containerStyle={{ flex: 1 }}
            label="Nr.Blerje"
            value={String(draft.no || db.nextPurchase || 1)}
            editable={false}
          />
          <Field
            containerStyle={{ flex: 1 }}
            label="Data"
            value={draft.date}
            onChangeText={(v) => setDraft({ date: v })}
            placeholder="2026-01-01"
          />
        </View>
        <View style={{ paddingHorizontal: 12, marginTop: 4 }}>
          <Text style={{ color: colors.muted, fontWeight: "700", marginBottom: 6 }}>Magazina *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {warehouseNames(db).map((w) => (
              <Pressable
                key={w}
                onPress={() => setDraft({ store: w })}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 18,
                  backgroundColor: w === draft.store ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: w === draft.store ? colors.primary : colors.border,
                }}
              >
                <Text style={{ color: w === draft.store ? "#fff" : colors.foreground, fontWeight: "700", fontSize: 13 }}>
                  {w}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Auto Fletë Hyrje toggle */}
        <View style={{ paddingHorizontal: 12, marginTop: 10 }}>
          <Pressable
            onPress={() => setDraft({ autoInbound: !draft.autoInbound })}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              padding: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: draft.autoInbound ? colors.primary : colors.border,
              backgroundColor: draft.autoInbound ? "#eef4ff" : colors.surface,
            }}
          >
            <IconSymbol
              name={draft.autoInbound ? "checkmark.circle.fill" : "circle"}
              size={22}
              color={draft.autoInbound ? colors.primary : colors.muted}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "800", color: colors.foreground, fontSize: 13 }}>
                Krijo automatikisht Fletë Hyrje
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                Shton stokun në magazinën e zgjedhur dhe lidh fletën me blerjen.
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 12 }}>
          <Text style={{ color: colors.muted, fontWeight: "700", marginTop: 4, marginBottom: 4 }}>Furnitori</Text>
          <Pressable
            onPress={() => router.push({ pathname: "/party-select", params: { kind: "supplier" } } as any)}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 14,
              backgroundColor: colors.surface,
            }}
          >
            <Text style={{ color: draft.party ? colors.foreground : colors.muted, fontWeight: "700" }}>
              {draft.party || "Zgjidh furnitor"}
            </Text>
          </Pressable>
        </View>

        {/* Smart Repeat — Blerje e shpejtë (shfaqet kur furnitori ka histori) */}
        {draft.party && lastPurchase ? (
          <View style={{ paddingHorizontal: 12, marginTop: 10 }}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: "#dcfce7",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontWeight: "900", color: colors.foreground, fontSize: 14 }}>⚡ Blerje e shpejtë</Text>
                <View
                  style={{
                    backgroundColor: "#ecfdf5",
                    borderWidth: 1,
                    borderColor: "#bbf7d0",
                    borderRadius: 999,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <Text style={{ color: "#047857", fontWeight: "900", fontSize: 11 }}>Repeat</Text>
                </View>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
                Blerja e fundit #{lastPurchase.no} • {lastPurchase.date} • {lastPurchase.items.length} artikuj
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                Ky furnitor shpesh sjell të njëjtat artikuj.
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Btn fullWidth title="Kopjo blerjen e fundit" onPress={copyLastPurchase} />
                </View>
                <View style={{ flex: 1 }}>
                  <Btn fullWidth variant="soft" title="Shto artikujt e zakonshëm" onPress={addUsualPurchaseItems} />
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* Shitësi / Agjenti (salesman) */}
        <View style={{ paddingHorizontal: 12, marginTop: 8 }}>
          <Field
            label="Shitësi"
            value={draft.salesman || ""}
            onChangeText={(v) => setDraft({ salesman: v })}
            placeholder="Emri i shitësit"
          />
        </View>

        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16 }}>
            <Text style={{ fontWeight: "900", color: colors.foreground, fontSize: 15 }}>
              Artikujt e blere ({draft.items.length})
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Sub: {fmt(subtotal)}</Text>
          </View>
          {draft.items.map((it, idx) => (
            <View
              key={idx}
              style={{
                marginHorizontal: 12,
                marginVertical: 4,
                backgroundColor: colors.surface,
                borderRadius: 8,
                padding: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "800", flex: 1 }} numberOfLines={1}>
                  {it.productName}
                </Text>
                <Pressable onPress={() => removeItem(idx)} hitSlop={8}>
                  <IconSymbol name="trash.fill" size={18} color={colors.error} />
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {fmt(it.qty)} {it.unit} x {fmt(it.rate)}
                </Text>
                <Text style={{ fontWeight: "800", color: colors.foreground }}>{fmt(it.total)}</Text>
              </View>
            </View>
          ))}
          <View style={{ paddingHorizontal: 12, marginTop: 6 }}>
            <Btn
              fullWidth
              variant="soft"
              icon="plus"
              title="Shto artikuj"
              onPress={() => router.push({ pathname: "/sale-item-select", params: { kind: "purchase" } } as any)}
            />
          </View>
        </View>

        <View style={{ marginTop: 16, paddingHorizontal: 12 }}>
          <Text style={{ fontWeight: "900", color: colors.foreground, fontSize: 15, marginBottom: 4 }}>Pagesa</Text>
          <Field
            label="Rrumbullakimi"
            keyboardType="numeric"
            value={String(draft.roundOff || "")}
            onChangeText={(v) => setDraft({ roundOff: num(v) })}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Field containerStyle={{ flex: 1 }} label="Totali" value={fmt(total)} editable={false} />
            <Field
              containerStyle={{ flex: 1 }}
              label="Paguar"
              keyboardType="numeric"
              value={String(draft.paid || "")}
              onChangeText={(v) => setDraft({ paid: num(v) })}
            />
          </View>
          <Pressable
            onPress={() => setDraft({ paid: total })}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 12,
              borderRadius: 10,
              backgroundColor: num(draft.paid) >= total && total > 0 ? "#e8f8ee" : colors.surface,
              borderWidth: 1,
              borderColor: num(draft.paid) >= total && total > 0 ? colors.success : colors.border,
              marginVertical: 10,
            }}
          >
            <IconSymbol
              name="checkmark.circle.fill"
              size={20}
              color={num(draft.paid) >= total && total > 0 ? colors.success : colors.muted}
            />
            <Text style={{ fontWeight: "800", color: num(draft.paid) >= total && total > 0 ? colors.success : colors.foreground }}>
              Paguar te plote
            </Text>
          </Pressable>
          <Field label="Detyrim" value={fmt(due)} editable={false} />
          <Field label="Menyra" value={draft.paymentType} onChangeText={(v) => setDraft({ paymentType: v })} />
          <Field label="Shenim" value={draft.note} onChangeText={(v) => setDraft({ note: v })} />
        </View>
      </ScrollView>

      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.surface,
          paddingHorizontal: 12,
          paddingTop: 12,
          paddingBottom: footerPad,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Btn fullWidth title={saving ? "Duke ruajtur..." : "Ruaj blerjen"} onPress={save} />
      </View>
    </ScreenContainer>
  );
}
