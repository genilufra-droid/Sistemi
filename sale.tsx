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
  commitSaleInvoice,
  warehouseNames,
  currentSalesmanName,
  attachLocation,
  activeRoute,
  latestInvoiceForCustomer,
  copyLastCustomerInvoice,
  addUsualCustomerItems,
  type Invoice,
} from "@/lib/store";
import { captureLocation, geoToRoutePoint } from "@/lib/location";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function SaleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // Lift the action bar clearly above the Android gesture/nav bar so buttons are easy to tap.
  const footerPad = insets.bottom + 16;
  const { db, setDB } = useStore();
  const params = useLocalSearchParams<{ edit?: string }>();
  const draft = useDraft();
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (params.edit) {
      const inv = db.invoices.find((i) => String(i.no) === String(params.edit));
      if (inv) {
        setDraft({
          kind: "sale",
          party: inv.customer,
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
          autoOutbound: inv.autoCreateOutboundDoc !== false,
        });
        return;
      }
    }
    if (getDraft().kind !== "sale" || getDraft().items.length === 0) {
      resetDraft("sale", db.stores[0] || "");
      setDraft({ salesman: currentSalesmanName(db) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtotal = draft.items.reduce((s, it) => s + num(it.total), 0);
  const total = subtotal + num(draft.roundOff);
  const paidAmount = num(draft.paid);
  // If paid more than total -> kusuri (change), due stays 0; else due = remaining.
  const change = paidAmount > total ? paidAmount - total : 0;
  const due = paidAmount >= total ? 0 : total - paidAmount;
  const totalCost = draft.items.reduce((s, it) => s + num(it.cost), 0);
  const profit = total - totalCost - num(draft.roundOff);
  const margin = total ? (profit / total) * 100 : 0;

  const removeItem = (idx: number) => {
    setDraft((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  };

  // --- Smart Repeat (Faturë e shpejtë) -------------------------------------
  // Suggestions based on the selected customer's previous invoices.
  const lastInvoice = React.useMemo(
    () => (draft.party ? latestInvoiceForCustomer(db, draft.party) : null),
    [db, draft.party],
  );

  const copyLastInvoice = () => {
    if (!draft.party) return;
    const items = copyLastCustomerInvoice(db, draft.party);
    if (!items.length) {
      Alert.alert("Faturë e shpejtë", "Nuk u gjet faturë për kopjim.");
      return;
    }
    // Copy only the LINES into a fresh invoice: new no/date/time, paid 0,
    // round-off 0, credit mode by default. GPS/route/timestamp are NOT copied.
    setDraft((p) => ({
      ...p,
      items,
      paid: 0,
      roundOff: 0,
      mode: "Me detyrim",
    }));
    Alert.alert("Faturë e shpejtë", `Fatura u kopjua me ${items.length} artikuj.`);
  };

  const addUsualItems = () => {
    if (!draft.party) return;
    const add = addUsualCustomerItems(db, draft.party, draft.items);
    if (!add.length) {
      Alert.alert("Faturë e shpejtë", "Artikujt kryesorë janë tashmë në faturë (ose s'ka histori).");
      return;
    }
    setDraft((p) => ({ ...p, items: [...p.items, ...add] }));
    Alert.alert("Faturë e shpejtë", `U shtuan ${add.length} artikuj të zakonshëm.`);
  };

  const save = async (andNew: boolean = false) => {
    if (saving) return;
    if (!draft.party) {
      Alert.alert("Klienti", "Zgjidh nje klient.");
      return;
    }
    if (!draft.store) {
      Alert.alert("Magazina", "Zgjidh magazinën për këtë shitje.");
      return;
    }
    if (draft.items.length === 0) {
      Alert.alert("Artikuj", "Shto te pakten nje artikull.");
      return;
    }

    setSaving(true);
    try {
      const editingNo = draft.no;
      const no = editingNo || db.nextInvoice;
      let newInvoice: Invoice = {
        no,
        date: draft.date,
        time: draft.time,
        customer: draft.party,
        billingName: draft.party,
        store: draft.store || db.stores[0],
        mode: draft.mode,
        items: draft.items.map((it) => ({ ...it })),
        subtotal,
        roundOff: num(draft.roundOff),
        total,
        paid: num(draft.paid),
        due,
        change,
        paymentType: draft.paymentType,
        note: draft.note,
        totalCost,
        profit,
      };

      const nextDB = { ...db };

      // Salesman + GPS: capture location (if enabled) and attach to the invoice.
      const salesman = (draft.salesman || currentSalesmanName(db)).trim();
      const route = activeRoute(db);
      const geo =
        db.settings?.gpsEnabled !== false ? await captureLocation() : undefined;
      newInvoice = attachLocation(newInvoice, salesman, geo, route?.id);
      // If a route is active and we got a valid point, append it to that route.
      if (route) {
        const pt = geo ? geoToRoutePoint(geo) : null;
        if (pt) {
          nextDB.routeTracks = (nextDB.routeTracks || []).map((r) =>
            r.id === route.id ? { ...r, points: [...r.points, pt] } : r,
          );
        }
      }
      // Apply the stock effect exactly once. When the auto toggle is ON a
      // linked Fletë Dalje is created (which validates + deducts stock); when
      // OFF the legacy deduction + ledger path runs. Editing reverses the old
      // effect first inside commitSaleInvoice.
      const res = commitSaleInvoice(nextDB, newInvoice, {
        autoOutbound: !!draft.autoOutbound,
        editingNo: editingNo || undefined,
      });
      if (res.error) {
        Alert.alert("Stoku i pamjaftueshëm", res.error);
        return;
      }
      await setDB(res.db);

      resetDraft("sale", db.stores[0] || "");
      if (!andNew) router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <Header
        title={draft.no ? `Shitje #${draft.no}` : "Shitje"}
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
      <ScrollView contentContainerStyle={{ paddingBottom: 240 + footerPad }}>
        {/* Meta */}
        <View style={{ flexDirection: "row", gap: 8, padding: 12 }}>
          <Field
            containerStyle={{ flex: 1 }}
            label="Nr.Fatura"
            value={String(draft.no || db.nextInvoice)}
            editable={false}
          />
          <Field
            containerStyle={{ flex: 1 }}
            label="Data"
            value={draft.date}
            onChangeText={(v) => setDraft({ date: v })}
            placeholder="2026-01-01"
          />
          <Field
            containerStyle={{ width: 90 }}
            label="Ora"
            value={draft.time}
            onChangeText={(v) => setDraft({ time: v })}
            placeholder="HH:MM"
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

        {/* Auto Fletë Dalje toggle */}
        <View style={{ paddingHorizontal: 12, marginTop: 10 }}>
          <Pressable
            onPress={() => setDraft({ autoOutbound: !draft.autoOutbound })}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              padding: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: draft.autoOutbound ? colors.primary : colors.border,
              backgroundColor: draft.autoOutbound ? "#eef4ff" : colors.surface,
            }}
          >
            <IconSymbol
              name={draft.autoOutbound ? "checkmark.circle.fill" : "circle"}
              size={22}
              color={draft.autoOutbound ? colors.primary : colors.muted}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "800", color: colors.foreground, fontSize: 13 }}>
                Krijo automatikisht Fletë Dalje Magazine
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                Zbret stokun nga magazina e zgjedhur dhe lidh fletën me faturën.
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Klienti */}
        <View style={{ paddingHorizontal: 12 }}>
          <Text style={{ color: colors.muted, fontWeight: "700", marginTop: 4, marginBottom: 4 }}>Klienti</Text>
          <Pressable
            onPress={() => router.push({ pathname: "/party-select", params: { kind: "customer" } } as any)}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 14,
              backgroundColor: colors.surface,
            }}
          >
            <Text style={{ color: draft.party ? colors.foreground : colors.muted, fontWeight: "700" }}>
              {draft.party || "Zgjidh klient (Klient Rastesor)"}
            </Text>
          </Pressable>
        </View>

        {/* Smart Repeat — Faturë e shpejtë (shfaqet kur klienti ka histori) */}
        {draft.party && lastInvoice ? (
          <View style={{ paddingHorizontal: 12, marginTop: 10 }}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: "#dbeafe",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontWeight: "900", color: colors.foreground, fontSize: 14 }}>⚡ Faturë e shpejtë</Text>
                <View
                  style={{
                    backgroundColor: "#eff6ff",
                    borderWidth: 1,
                    borderColor: "#bfdbfe",
                    borderRadius: 999,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <Text style={{ color: "#1d4ed8", fontWeight: "900", fontSize: 11 }}>Repeat</Text>
                </View>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
                Fatura e fundit #{lastInvoice.no} • {lastInvoice.date} • {lastInvoice.items.length} artikuj
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                Ky klient blen shpesh të njëjtat artikuj.
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Btn fullWidth title="Kopjo faturën e fundit" onPress={copyLastInvoice} />
                </View>
                <View style={{ flex: 1 }}>
                  <Btn fullWidth variant="soft" title="Shto artikujt e zakonshëm" onPress={addUsualItems} />
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* Shitësi (salesman) */}
        <View style={{ paddingHorizontal: 12, marginTop: 8 }}>
          <Field
            label="Shitësi"
            value={draft.salesman || ""}
            onChangeText={(v) => setDraft({ salesman: v })}
            placeholder="Emri i shitësit"
          />
        </View>

        {/* Artikujt */}
        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16 }}>
            <Text style={{ fontWeight: "900", color: colors.foreground, fontSize: 15 }}>
              Artikujt e faturuar ({draft.items.length})
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
                  {fmt(it.qty)} {it.unit} {it.freeQty > 0 ? `(+${fmt(it.freeQty)} fal.)` : ""} x {fmt(it.rate)}
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
              onPress={() => router.push({ pathname: "/sale-item-select", params: { kind: "sale" } } as any)}
            />
          </View>
        </View>

        {/* Pagesa */}
        <View style={{ marginTop: 16, paddingHorizontal: 12 }}>
          <Text style={{ fontWeight: "900", color: colors.foreground, fontSize: 15, marginBottom: 4 }}>Pagesa</Text>
          {/* Round-off with +/- buttons: user taps + then types e.g. 2 -> +2; taps - -> -2 */}
          <Text style={{ color: colors.muted, fontWeight: "700", marginBottom: 6, fontSize: 13 }}>Rrumbullakimi</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Pressable
              onPress={() => setDraft({ roundOff: -Math.abs(num(draft.roundOff)) })}
              style={{
                width: 46,
                height: 46,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: num(draft.roundOff) < 0 ? colors.error : colors.border,
                backgroundColor: num(draft.roundOff) < 0 ? "#fde8e8" : colors.surface,
              }}
            >
              <Text style={{ fontSize: 24, fontWeight: "900", color: num(draft.roundOff) < 0 ? colors.error : colors.foreground }}>−</Text>
            </Pressable>
            <Field
              containerStyle={{ flex: 1, marginBottom: 0 }}
              label={undefined as any}
              keyboardType="numeric"
              value={draft.roundOff ? String(Math.abs(num(draft.roundOff))) : ""}
              onChangeText={(v) => {
                const mag = Math.abs(num(v));
                const sign = num(draft.roundOff) < 0 ? -1 : 1;
                setDraft({ roundOff: sign * mag });
              }}
              placeholder="0"
            />
            <Pressable
              onPress={() => setDraft({ roundOff: Math.abs(num(draft.roundOff)) })}
              style={{
                width: 46,
                height: 46,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: num(draft.roundOff) > 0 ? colors.success : colors.border,
                backgroundColor: num(draft.roundOff) > 0 ? "#e8f8ee" : colors.surface,
              }}
            >
              <Text style={{ fontSize: 24, fontWeight: "900", color: num(draft.roundOff) > 0 ? colors.success : colors.foreground }}>+</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Field
              containerStyle={{ flex: 1 }}
              label={`Totali`}
              value={fmt(total)}
              editable={false}
            />
            <Field
              containerStyle={{ flex: 1 }}
              label="Dhene / Paguar"
              keyboardType="numeric"
              value={String(draft.paid || "")}
              onChangeText={(v) => setDraft({ paid: num(v) })}
            />
          </View>
          {/* Quick action: fill paid = total and mark fully paid */}
          <Pressable
            onPress={() => setDraft({ paid: total, mode: "Me arke" as any })}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 12,
              borderRadius: 10,
              backgroundColor: paidAmount >= total && total > 0 ? "#e8f8ee" : colors.surface,
              borderWidth: 1,
              borderColor: paidAmount >= total && total > 0 ? colors.success : colors.border,
              marginBottom: 10,
            }}
          >
            <IconSymbol
              name="checkmark.circle.fill"
              size={20}
              color={paidAmount >= total && total > 0 ? colors.success : colors.muted}
            />
            <Text style={{ fontWeight: "800", color: paidAmount >= total && total > 0 ? colors.success : colors.foreground }}>
              Paguar te plote
            </Text>
          </Pressable>
          {change > 0 ? (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#e8f8ee",
                borderWidth: 1,
                borderColor: colors.success,
                borderRadius: 10,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <Text style={{ fontWeight: "800", color: "#0a7d3a" }}>Kusuri (kthim)</Text>
              <Text style={{ fontWeight: "900", color: "#0a7d3a", fontSize: 16 }}>{fmt(change)}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Field
              containerStyle={{ flex: 1 }}
              label="Detyrim"
              value={fmt(due)}
              editable={false}
            />
            <Field
              containerStyle={{ flex: 1 }}
              label="Menyra"
              value={draft.paymentType}
              onChangeText={(v) => setDraft({ paymentType: v })}
            />
          </View>
          <Field
            label="Shenim"
            value={draft.note}
            onChangeText={(v) => setDraft({ note: v })}
            placeholder="(Opsionale)"
          />
        </View>

        {/* Profit */}
        <View
          style={{
            marginTop: 12,
            marginHorizontal: 12,
            backgroundColor: "#f0f9ff",
            padding: 12,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#cfe6f8",
          }}
        >
          <Text style={{ fontWeight: "800", color: "#0a66aa", marginBottom: 6 }}>Fitimi</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.muted }}>Vlera:</Text>
            <Text style={{ fontWeight: "800" }}>{fmt(total)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.muted }}>Kosto:</Text>
            <Text style={{ fontWeight: "800" }}>{fmt(totalCost)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.muted }}>Fitim:</Text>
            <Text style={{ fontWeight: "800", color: profit >= 0 ? colors.success : colors.error }}>
              {fmt(profit)} ({margin.toFixed(1)}%)
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky bottom */}
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
          flexDirection: "row",
          gap: 8,
        }}
      >
        <Btn title="Ruaj & i ri" variant="soft" onPress={() => save(true)} />
        <Btn title={saving ? "Duke ruajtur..." : "Ruaj"} onPress={() => save(false)} style={{ flex: 1 }} />
      </View>
    </ScreenContainer>
  );
}
