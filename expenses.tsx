/**
 * Expenses (Shpenzime) screen — categories + items tabs
 * Inspired by Vyapar's Expenses module, redesigned for Sistemi Genit.
 */
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Badge, Card } from "@/components/ui-kit";
import { useColors } from "@/hooks/use-colors";
import { money, num, totalExpenses, useStore, type Expense } from "@/lib/store";

type Tab = "categories" | "items";

export default function ExpensesScreen() {
  const router = useRouter();
  const colors = useColors();
  const { db } = useStore();
  const [tab, setTab] = useState<Tab>("categories");

  const total = useMemo(() => totalExpenses(db), [db]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const cat of db.expenseCategories || []) {
      map.set(cat, { count: 0, total: 0 });
    }
    for (const e of db.expenses || []) {
      const existing = map.get(e.category) || { count: 0, total: 0 };
      map.set(e.category, {
        count: existing.count + 1,
        total: existing.total + num(e.amount),
      });
    }
    return [...map.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [db]);

  const sortedExpenses = useMemo(
    () => [...(db.expenses || [])].sort((a, b) => b.date.localeCompare(a.date)),
    [db.expenses],
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Shpenzime",
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: "#fff",
        }}
      />
      <ScreenContainer>
        <View style={{ padding: 12, gap: 12 }}>
          <Card>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Total Shpenzime</Text>
            <Text style={{ color: colors.error, fontSize: 24, fontWeight: "700", marginTop: 2 }}>
              {money(total, db.company.currency)}
            </Text>
          </Card>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <TabButton label="Kategoritë" active={tab === "categories"} onPress={() => setTab("categories")} />
            <TabButton label="Të gjitha" active={tab === "items"} onPress={() => setTab("items")} />
          </View>
        </View>

        {tab === "categories" ? (
          <FlatList
            data={byCategory}
            keyExtractor={(item) => item.category}
            contentContainerStyle={{ padding: 12, paddingTop: 0, gap: 10, paddingBottom: 120 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/expense-form" as any, params: { category: item.category } })
                }
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Card>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600" }}>
                        {item.category}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                        {item.count} {item.count === 1 ? "shpenzim" : "shpenzime"}
                      </Text>
                    </View>
                    <Text style={{ color: colors.error, fontSize: 16, fontWeight: "700" }}>
                      {money(item.total, db.company.currency)}
                    </Text>
                  </View>
                </Card>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={{ color: colors.muted, textAlign: "center", padding: 20 }}>
                Asnjë kategori. Shto një shpenzim për të filluar.
              </Text>
            }
          />
        ) : (
          <FlatList
            data={sortedExpenses}
            keyExtractor={(e) => String(e.id)}
            contentContainerStyle={{ padding: 12, paddingTop: 0, gap: 10, paddingBottom: 120 }}
            renderItem={({ item }) => <ExpenseRow item={item} currency={db.company.currency} colors={colors} />}
            ListEmptyComponent={
              <Text style={{ color: colors.muted, textAlign: "center", padding: 20 }}>
                Ende asnjë shpenzim i regjistruar.
              </Text>
            }
          />
        )}

        <Pressable
          onPress={() => router.push("/expense-form" as any)}
          style={({ pressed }) => ({
            position: "absolute",
            right: 16,
            bottom: 24,
            backgroundColor: colors.error,
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderRadius: 30,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            elevation: 4,
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <IconSymbol name="plus" size={20} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700" }}>Shto shpenzim</Text>
        </Pressable>
      </ScreenContainer>
    </>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        alignItems: "center",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ color: active ? "#fff" : colors.foreground, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

function ExpenseRow({
  item,
  currency,
  colors,
}: {
  item: Expense;
  currency: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>
              {item.category}
            </Text>
            <Badge tone="neutral">{item.paymentMethod}</Badge>
          </View>
          {item.description ? (
            <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}
          <Text style={{ color: colors.muted, fontSize: 11 }}>{item.date}</Text>
        </View>
        <Text style={{ color: colors.error, fontWeight: "700", fontSize: 16 }}>
          {money(item.amount, currency)}
        </Text>
      </View>
    </Card>
  );
}
