import React from "react";
import { Alert, ScrollView, View, Text, Pressable } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { Header, Btn, Field } from "@/components/ui-kit";
import { useColors } from "@/hooks/use-colors";
import { router, useLocalSearchParams } from "expo-router";
import {
  nextCustomerId,
  nextSupplierId,
  num,
  useStore,
  type Customer,
} from "@/lib/store";

export default function PartyFormScreen() {
  const { db, setDB } = useStore();
  const colors = useColors();
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const kind = (params.kind || "customer") as "customer" | "supplier";
  const list = kind === "customer" ? db.customers : db.suppliers;
  const editing = params.id ? list.find((p) => String(p.id) === String(params.id)) : null;

  const [name, setName] = React.useState(editing?.name || "");
  const [phone, setPhone] = React.useState(editing?.phone || "");
  const [city, setCity] = React.useState(editing?.city || "");
  const [address, setAddress] = React.useState(editing?.address || "");
  const [nipt, setNipt] = React.useState(editing?.nipt || "");
  const [opening, setOpening] = React.useState(String(editing?.openingBalance ?? ""));
  const [note, setNote] = React.useState(editing?.note || "");
  const [priceList, setPriceList] = React.useState<number>(editing?.defaultPriceList ?? 0);
  const listNames = db.company.priceListNames || [];

  const save = async () => {
    if (!name.trim()) {
      Alert.alert("Emri", "Emri eshte i detyrueshem.");
      return;
    }
    const id = editing?.id ?? (kind === "customer" ? nextCustomerId(db) : nextSupplierId(db));
    const obj: Customer = {
      id,
      name: name.trim(),
      phone: phone.trim() || undefined,
      city: city.trim() || undefined,
      address: address.trim() || undefined,
      nipt: nipt.trim() || undefined,
      openingBalance: opening ? num(opening) : undefined,
      note: note.trim() || undefined,
      defaultPriceList: kind === "customer" ? priceList : undefined,
    };
    if (kind === "customer") {
      const next = editing
        ? db.customers.map((c) => (c.id === id ? obj : c))
        : [...db.customers, obj];
      await setDB({ ...db, customers: next });
    } else {
      const next = editing
        ? db.suppliers.map((s) => (s.id === id ? obj : s))
        : [...db.suppliers, obj];
      await setDB({ ...db, suppliers: next });
    }
    router.back();
  };

  const remove = async () => {
    if (!editing) return;
    Alert.alert("Fshi", `Fshi ${editing.name}?`, [
      { text: "Anulo" },
      {
        text: "Fshi",
        style: "destructive",
        onPress: async () => {
          if (kind === "customer") {
            await setDB({ ...db, customers: db.customers.filter((c) => c.id !== editing.id) });
          } else {
            await setDB({ ...db, suppliers: db.suppliers.filter((c) => c.id !== editing.id) });
          }
          router.back();
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <Header
        title={editing ? `Modifiko ${kind === "customer" ? "klientin" : "furnitorin"}` : `Shto ${kind === "customer" ? "klient" : "furnitor"}`}
        back={() => router.back()}
      />
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
        <Field label="Emri *" value={name} onChangeText={setName} />
        <Field label="Telefoni" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="Qyteti" value={city} onChangeText={setCity} />
        <Field label="Adresa" value={address} onChangeText={setAddress} />
        <Field label="NIPT" value={nipt} onChangeText={setNipt} />
        <Field label="Balanca fillestare" keyboardType="numeric" value={opening} onChangeText={setOpening} />
        {kind === "customer" ? (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.muted, fontWeight: "800", marginBottom: 6, fontSize: 13 }}>
              Lista e cmimit (parazgjedhur)
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {Array.from({ length: 10 }).map((_, i) => {
                const active = priceList === i;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setPriceList(i)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      backgroundColor: active ? colors.tint : colors.surface,
                      borderWidth: 1,
                      borderColor: active ? colors.tint : colors.border,
                    }}
                  >
                    <Text style={{ color: active ? "#fff" : colors.foreground, fontWeight: "700", fontSize: 13 }}>
                      {listNames[i] || `Lista ${i + 1}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        <Field label="Shenim" value={note} onChangeText={setNote} />
        <Btn fullWidth title={editing ? "Ruaj ndryshimet" : "Ruaj"} onPress={save} />
        {editing ? <Btn fullWidth title="Fshi" variant="warn" onPress={remove} style={{ marginTop: 8 }} /> : null}
      </ScrollView>
    </ScreenContainer>
  );
}
