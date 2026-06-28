import React from "react";
import { Alert, ScrollView } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { Header, Btn, Field } from "@/components/ui-kit";
import { router, useLocalSearchParams } from "expo-router";
import { num, todayStr, useStore, nextPaymentId, partyDue } from "@/lib/store";

export default function PartyPaymentScreen() {
  const { db, setDB } = useStore();
  const params = useLocalSearchParams<{ name?: string; kind?: string }>();
  const partyType = (params.kind || "customer") as "customer" | "supplier";
  const partyName = params.name || "";
  const due =
    partyType === "customer"
      ? partyDue(db, partyName)
      : (db.purchases.filter((p) => p.supplier === partyName).reduce((s, p) => s + num(p.due), 0));

  const [amount, setAmount] = React.useState(String(Math.max(0, due)));
  const [date, setDate] = React.useState(todayStr());
  const [method, setMethod] = React.useState("Cash");
  const [ref, setRef] = React.useState("");
  const [note, setNote] = React.useState("");

  const save = async () => {
    const amt = num(amount);
    if (!amt) {
      Alert.alert("Vlera", "Vendos nje vlere.");
      return;
    }
    const newPay = {
      id: nextPaymentId(db),
      partyType,
      party: partyName,
      date,
      amount: amt,
      method,
      ref: ref || undefined,
      note: note || undefined,
    };
    await setDB({ ...db, payments: [...db.payments, newPay] });
    router.back();
  };

  return (
    <ScreenContainer>
      <Header title={`Pagese - ${partyName}`} back={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
        <Field label="Data" value={date} onChangeText={setDate} placeholder="2026-01-01" />
        <Field label="Vlera" keyboardType="numeric" value={amount} onChangeText={setAmount} />
        <Field label="Menyra" value={method} onChangeText={setMethod} placeholder="Cash, Banke, Kartelle..." />
        <Field label="Referenca" value={ref} onChangeText={setRef} placeholder="Nr.fatures, ID transaksioni..." />
        <Field label="Shenim" value={note} onChangeText={setNote} placeholder="(Opsionale)" />
        <Btn fullWidth title="Ruaj pagesen" onPress={save} />
      </ScrollView>
    </ScreenContainer>
  );
}
