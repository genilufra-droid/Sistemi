import React from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Header, Btn, Field } from "@/components/ui-kit";
import { router } from "expo-router";
import { num, useStore } from "@/lib/store";

export default function TxnSettingsScreen() {
  const colors = useColors();
  const { db, setDB } = useStore();

  const [nextInv, setNextInv] = React.useState(String(db.nextInvoice));
  const [nextPur, setNextPur] = React.useState(String(db.nextPurchase));
  const [storesText, setStoresText] = React.useState(db.stores.join("\n"));

  const save = async () => {
    const stores = storesText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    await setDB({
      ...db,
      nextInvoice: num(nextInv) || db.nextInvoice,
      nextPurchase: num(nextPur) || db.nextPurchase,
      stores: stores.length > 0 ? stores : db.stores,
    });
    Alert.alert("OK", "Cilesimet u ruajten.");
    router.back();
  };

  return (
    <ScreenContainer>
      <Header title="Cilesime transaksioni" back={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
        <View
          style={{
            backgroundColor: "#dceffd",
            padding: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#bfe0fa",
            marginBottom: 12,
          }}
        >
          <Text style={{ color: colors.primary, fontWeight: "800" }}>Numerimi i fatures</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>
            Numri tjeter qe do te perdoret per faturen e radhes.
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Field containerStyle={{ flex: 1 }} label="Nr. fatura" keyboardType="numeric" value={nextInv} onChangeText={setNextInv} />
          <Field containerStyle={{ flex: 1 }} label="Nr. blerje" keyboardType="numeric" value={nextPur} onChangeText={setNextPur} />
        </View>
        <Text style={{ color: colors.muted, fontWeight: "800", marginTop: 12, marginBottom: 4 }}>
          Magazinat (nje per rresht)
        </Text>
        <Field
          label="Magazinat"
          value={storesText}
          onChangeText={setStoresText}
          multiline
          style={{ minHeight: 100, textAlignVertical: "top" }}
        />
        <Btn fullWidth title="Ruaj" onPress={save} />
      </ScrollView>
    </ScreenContainer>
  );
}
