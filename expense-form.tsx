/**
 * Expense form — add or edit an expense entry.
 * Inspired by Vyapar's expense form, redesigned for Sistemi Genit.
 */
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { Btn, Card } from "@/components/ui-kit";
import { useColors } from "@/hooks/use-colors";
import { nextExpenseId, num, todayStr, useStore, type Expense } from "@/lib/store";

const PAYMENT_METHODS = ["Para në dorë", "Bankë", "Kartë", "Tjetër"];

export default function ExpenseFormScreen() {
  const router = useRouter();
  const colors = useColors();
  const { db, setDB } = useStore();
  const params = useLocalSearchParams<{ id?: string; category?: string }>();

  const editing: Expense | undefined =
    params.id ? db.expenses.find((e) => e.id === Number(params.id)) : undefined;

  const [date, setDate] = useState(editing?.date || todayStr());
  const [category, setCategory] = useState(
    editing?.category || params.category || db.expenseCategories[0] || "Të tjera",
  );
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [description, setDescription] = useState(editing?.description || "");
  const [paymentMethod, setPaymentMethod] = useState(editing?.paymentMethod || "Para në dorë");
  const [ref, setRef] = useState(editing?.ref || "");

  const save = async () => {
    const value = num(amount);
    if (value <= 0) {
      Alert.alert("Gabim", "Shuma duhet të jetë më e madhe se 0.");
      return;
    }
    if (editing) {
      await setDB((prev) => ({
        ...prev,
        expenses: prev.expenses.map((e) =>
          e.id === editing.id
            ? { ...e, date, category, amount: value, description, paymentMethod, ref }
            : e,
        ),
      }));
    } else {
      const next: Expense = {
        id: nextExpenseId(db),
        date,
        category,
        amount: value,
        description,
        paymentMethod,
        ref,
      };
      await setDB((prev) => ({ ...prev, expenses: [next, ...prev.expenses] }));
    }
    router.back();
  };

  const remove = async () => {
    if (!editing) return;
    Alert.alert("Fshi shpenzimin", "Je i sigurt që do ta fshish këtë shpenzim?", [
      { text: "Anulo", style: "cancel" },
      {
        text: "Fshi",
        style: "destructive",
        onPress: async () => {
          await setDB((prev) => ({
            ...prev,
            expenses: prev.expenses.filter((e) => e.id !== editing.id),
          }));
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: editing ? "Edito shpenzimin" : "Shto shpenzim",
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: "#fff",
        }}
      />
      <ScreenContainer>
        <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}>
          <Card>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Data</Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              style={{
                color: colors.foreground,
                fontSize: 16,
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            />
          </Card>

          <Card>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>Kategoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {db.expenseCategories.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    backgroundColor: c === category ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: c === category ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: c === category ? "#fff" : colors.foreground,
                      fontWeight: "600",
                      fontSize: 13,
                    }}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Card>

          <Card>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Shuma ({db.company.currency})</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              style={{
                color: colors.foreground,
                fontSize: 22,
                fontWeight: "700",
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            />
          </Card>

          <Card>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Përshkrim (opsional)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="P.sh. fatura e dritave për nëntorin"
              placeholderTextColor={colors.muted}
              multiline
              style={{
                color: colors.foreground,
                fontSize: 15,
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                minHeight: 40,
              }}
            />
          </Card>

          <Card>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>Mënyra e pagesës</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {PAYMENT_METHODS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setPaymentMethod(m)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    backgroundColor: m === paymentMethod ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: m === paymentMethod ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: m === paymentMethod ? "#fff" : colors.foreground,
                      fontWeight: "600",
                      fontSize: 13,
                    }}
                  >
                    {m}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>

          <Card>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Referencë (opsional)</Text>
            <TextInput
              value={ref}
              onChangeText={setRef}
              placeholder="P.sh. nr. faturës"
              placeholderTextColor={colors.muted}
              style={{
                color: colors.foreground,
                fontSize: 15,
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            />
          </Card>

          <Btn title={editing ? "Ruaj ndryshimet" : "Ruaj shpenzimin"} onPress={save} />
          {editing ? <Btn title="Fshi shpenzimin" variant="warn" onPress={remove} /> : null}
        </ScrollView>
      </ScreenContainer>
    </>
  );
}
