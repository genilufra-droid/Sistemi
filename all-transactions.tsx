import React from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Header, Toggle, Badge } from "@/components/ui-kit";
import { router } from "expo-router";
import { fmt, useStore } from "@/lib/store";

type Row =
  | { kind: "sale"; date: string; no: number; party: string; total: number; due: number }
  | { kind: "purchase"; date: string; no: number; party: string; total: number; due: number }
  | { kind: "payment"; date: string; partyType: "customer" | "supplier"; party: string; amount: number; method: string };

export default function AllTransactionsScreen() {
  const colors = useColors();
  const { db } = useStore();
  const [filter, setFilter] = React.useState<"all" | "sale" | "purchase" | "payment">("all");

  const rows: Row[] = React.useMemo(() => {
    const sales = db.invoices.map(
      (i) => ({ kind: "sale", date: i.date, no: i.no, party: i.customer, total: i.total, due: i.due } as Row),
    );
    const purs = db.purchases.map(
      (i) => ({ kind: "purchase", date: i.date, no: i.no, party: i.supplier, total: i.total, due: i.due } as Row),
    );
    const pays = db.payments.map(
      (p) => ({ kind: "payment", date: p.date, partyType: p.partyType, party: p.party, amount: p.amount, method: p.method } as Row),
    );
    let all = [...sales, ...purs, ...pays];
    if (filter !== "all") all = all.filter((r) => r.kind === filter);
    return all.sort((a, b) => b.date.localeCompare(a.date));
  }, [db, filter]);

  return (
    <ScreenContainer>
      <Header title="Te gjitha transaksionet" back={() => router.back()} />
      <View style={{ padding: 12 }}>
        <Toggle
          value={filter}
          onChange={(v) => setFilter(v as any)}
          options={[
            { value: "all", label: "Te gjitha" },
            { value: "sale", label: "Shitje" },
            { value: "purchase", label: "Blerje" },
            { value: "payment", label: "Pagesa" },
          ]}
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={{ textAlign: "center", color: colors.muted, marginTop: 30 }}>Asnje transaksion ende.</Text>
        }
        renderItem={({ item }) => {
          if (item.kind === "payment") {
            return (
              <View
                style={{
                  marginHorizontal: 12,
                  marginVertical: 4,
                  backgroundColor: colors.surface,
                  padding: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <Badge tone="paid">Pagese</Badge>
                    <Text style={{ fontWeight: "800" }}>{item.party}</Text>
                  </View>
                  <Text style={{ fontWeight: "800", color: colors.success }}>{fmt(item.amount)}</Text>
                </View>
                <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>
                  {item.date} • {item.method} • {item.partyType === "customer" ? "Klient" : "Furnitor"}
                </Text>
              </View>
            );
          }
          return (
            <Pressable
              onPress={() =>
                item.kind === "sale"
                  ? router.push({ pathname: "/invoice/[no]", params: { no: String(item.no) } } as any)
                  : router.push({ pathname: "/purchase/[no]", params: { no: String(item.no) } } as any)
              }
              style={{
                marginHorizontal: 12,
                marginVertical: 4,
                backgroundColor: colors.surface,
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  <Badge tone={item.kind === "sale" ? "paid" : "open"}>{item.kind === "sale" ? "Shitje" : "Blerje"}</Badge>
                  <Text style={{ fontWeight: "800" }}>{item.party}</Text>
                </View>
                <Text style={{ fontWeight: "800", color: colors.foreground }}>{fmt(item.total)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  #{item.no} • {item.date}
                </Text>
                {item.due > 0 ? (
                  <Text style={{ color: colors.error, fontWeight: "800", fontSize: 12 }}>Detyrim: {fmt(item.due)}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </ScreenContainer>
  );
}
