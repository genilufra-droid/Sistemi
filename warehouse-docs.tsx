/**
 * Dokumente Magazine — hub for warehouse documents (Phase 1).
 * Quick access to Fletë Hyrje, Fletë Dalje, Transferim Magazine, Inventar Fizik,
 * plus a recent-documents feed for the active company.
 */
import { useMemo } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Badge, Card } from "@/components/ui-kit";
import { useColors } from "@/hooks/use-colors";
import { fmt, useStore } from "@/lib/store";

type Recent = {
  key: string;
  no: string;
  date: string;
  warehouse: string;
  kind: string;
  tone: "paid" | "open" | "neutral";
  lines: number;
};

export default function WarehouseDocsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { db } = useStore();

  const actions = [
    { label: "Fletë Hyrje", desc: "Shto stok në magazinë", icon: "tray.and.arrow.down.fill", path: "/inbound-doc" },
    { label: "Fletë Dalje", desc: "Zbrit stok nga magazina", icon: "tray.and.arrow.up.fill", path: "/outbound-doc" },
    { label: "Transferim Magazine", desc: "Lëviz stok mes magazinave", icon: "arrow.left.arrow.right", path: "/store-transfer" },
    { label: "Inventar Fizik", desc: "Numërim & rregullim stoku", icon: "checklist", path: "/inventory-doc" },
  ];

  const recent = useMemo<Recent[]>(() => {
    const rows: Recent[] = [];
    (db.inboundDocs || []).forEach((d) =>
      rows.push({ key: "fh" + d.id, no: d.no, date: d.date, warehouse: d.warehouse, kind: "Fletë Hyrje", tone: "paid", lines: d.lines.length }),
    );
    (db.outboundDocs || []).forEach((d) =>
      rows.push({ key: "fd" + d.id, no: d.no, date: d.date, warehouse: d.warehouse, kind: "Fletë Dalje", tone: "open", lines: d.lines.length }),
    );
    (db.inventoryDocs || []).forEach((d) =>
      rows.push({ key: "if" + d.id, no: d.no, date: d.date, warehouse: d.warehouse, kind: "Inventar", tone: "neutral", lines: d.lines.length }),
    );
    (db.transfers || []).forEach((d) =>
      rows.push({
        key: "tr" + d.id,
        no: d.transferNo || `TR-${d.id}`,
        date: d.date,
        warehouse: `${d.fromWarehouse} → ${d.toWarehouse}`,
        kind: "Transferim",
        tone: "neutral",
        lines: 1,
      }),
    );
    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.no.localeCompare(a.no)));
    return rows.slice(0, 50);
  }, [db.inboundDocs, db.outboundDocs, db.inventoryDocs, db.transfers]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Dokumente Magazine",
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: "#fff",
        }}
      />
      <ScreenContainer>
        <FlatList
          data={recent}
          keyExtractor={(r) => r.key}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 80 }}
          ListHeaderComponent={
            <View style={{ gap: 10, marginBottom: 4 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {actions.map((a) => (
                  <Pressable
                    key={a.path}
                    onPress={() => router.push(a.path as any)}
                    style={{ width: "47.5%" }}
                  >
                    <Card style={{ gap: 8, minHeight: 110, justifyContent: "center" }}>
                      <IconSymbol name={a.icon as any} size={26} color={colors.primary} />
                      <Text style={{ color: colors.foreground, fontWeight: "800", fontSize: 15 }}>{a.label}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>{a.desc}</Text>
                    </Card>
                  </Pressable>
                ))}
              </View>
              <Text style={{ color: colors.foreground, fontWeight: "800", fontSize: 15, marginTop: 6 }}>
                Dokumentet e fundit
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Badge tone={item.tone}>{item.kind}</Badge>
                    <Text style={{ color: colors.foreground, fontWeight: "700" }}>{item.no}</Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{item.warehouse}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{item.date}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{item.lines} artikuj</Text>
                </View>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <Text style={{ color: colors.muted, textAlign: "center", padding: 20 }}>
              Ende pa dokumente magazine.
            </Text>
          }
        />
      </ScreenContainer>
    </>
  );
}
