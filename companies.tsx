/**
 * Kompanitë — Phase 1 multi-company management.
 * List companies, switch the active company, add new companies, edit profile,
 * and activate/deactivate. Each company owns a fully isolated data slice.
 */
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Stack, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Badge, Btn, Card } from "@/components/ui-kit";
import { useColors } from "@/hooks/use-colors";
import { useCompanies, type CompanyMeta } from "@/lib/store";

export default function CompaniesScreen() {
  const router = useRouter();
  const colors = useColors();
  const {
    companies,
    activeCompanyId,
    switchCompany,
    createCompany,
    updateCompany,
    setCompanyStatus,
  } = useCompanies();

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CompanyMeta | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [fName, setFName] = useState("");
  const [fNipt, setFNipt] = useState("");
  const [fAddress, setFAddress] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fEmail, setFEmail] = useState("");

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || (c.nipt || "").toLowerCase().includes(q),
    );
  }, [companies, search]);

  const openAdd = () => {
    setEditing(null);
    setFName("");
    setFNipt("");
    setFAddress("");
    setFPhone("");
    setFEmail("");
    setShowForm(true);
  };

  const openEdit = (c: CompanyMeta) => {
    setEditing(c);
    setFName(c.name);
    setFNipt(c.nipt || "");
    setFAddress(c.address || "");
    setFPhone(c.phone || "");
    setFEmail(c.email || "");
    setShowForm(true);
  };

  const saveForm = async () => {
    const name = fName.trim();
    if (!name) {
      Alert.alert("Gabim", "Emri i kompanisë është i detyrueshëm.");
      return;
    }
    try {
      if (editing) {
        await updateCompany(editing.id, {
          name,
          nipt: fNipt.trim(),
          address: fAddress.trim(),
          phone: fPhone.trim(),
          email: fEmail.trim(),
        });
      } else {
        await createCompany({
          name,
          nipt: fNipt.trim(),
          address: fAddress.trim(),
          phone: fPhone.trim(),
          email: fEmail.trim(),
        });
      }
      setShowForm(false);
    } catch (e: any) {
      Alert.alert("Gabim", e?.message || String(e));
    }
  };

  const toggleStatus = (c: CompanyMeta) => {
    const next = c.status === "active" ? "inactive" : "active";
    if (next === "inactive") {
      if (c.id === activeCompanyId) {
        Alert.alert("Nuk lejohet", "Nuk mund të çaktivizosh kompaninë aktive. Ndërro kompaninë fillimisht.");
        return;
      }
      const active = companies.filter((x) => x.status === "active");
      if (active.length <= 1) {
        Alert.alert("Nuk lejohet", "Duhet të kesh të paktën një kompani aktive.");
        return;
      }
    }
    setCompanyStatus(c.id, next);
  };

  const onSwitch = async (c: CompanyMeta) => {
    if (c.id === activeCompanyId) return;
    if (c.status !== "active") {
      Alert.alert("Joaktive", "Kjo kompani është joaktive. Aktivizoje për ta përdorur.");
      return;
    }
    await switchCompany(c.id);
    Alert.alert("Kompania u ndërrua", `Tani po punon me: ${c.name}`);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Kompanitë",
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: "#fff",
        }}
      />
      <ScreenContainer>
        <View style={{ padding: 12, gap: 10 }}>
          <Btn title="Shto kompani" icon="plus" onPress={openAdd} fullWidth />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 12,
            }}
          >
            <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Kërko kompani..."
              placeholderTextColor={colors.muted}
              style={{ flex: 1, color: colors.foreground, paddingVertical: 10 }}
            />
          </View>

          {showForm ? (
            <Card>
              <Text style={{ color: colors.foreground, fontWeight: "800", marginBottom: 6 }}>
                {editing ? "Ndrysho kompaninë" : "Kompani e re"}
              </Text>
              <LabeledInput label="Emri *" value={fName} onChangeText={setFName} placeholder="P.sh. Tregtia Genit SHPK" />
              <LabeledInput label="NIPT" value={fNipt} onChangeText={setFNipt} placeholder="(Opsionale)" />
              <LabeledInput label="Adresa" value={fAddress} onChangeText={setFAddress} placeholder="(Opsionale)" />
              <LabeledInput label="Telefon" value={fPhone} onChangeText={setFPhone} placeholder="(Opsionale)" />
              <LabeledInput label="Email" value={fEmail} onChangeText={setFEmail} placeholder="(Opsionale)" />
              {!editing ? (
                <Text style={{ color: colors.muted, fontSize: 11, fontStyle: "italic", marginBottom: 6 }}>
                  Kompania e re krijohet me një magazinë bazë “Magazina Kryesore” dhe me të dhëna bosh.
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                <View style={{ flex: 1 }}>
                  <Btn title="Anulo" variant="ghost" onPress={() => setShowForm(false)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Btn title="Ruaj" onPress={saveForm} />
                </View>
              </View>
            </Card>
          ) : null}
        </View>

        <FlatList
          data={list}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 12, paddingTop: 0, gap: 10, paddingBottom: 80 }}
          renderItem={({ item }) => {
            const isActive = item.id === activeCompanyId;
            return (
              <Pressable onPress={() => onSwitch(item)}>
                <Card
                  style={{
                    borderWidth: isActive ? 2 : 1,
                    borderColor: isActive ? colors.primary : colors.border,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>{item.name}</Text>
                        {isActive ? <Badge tone="paid">Aktive tani</Badge> : null}
                        {item.status === "inactive" ? <Badge tone="open">Joaktive</Badge> : null}
                      </View>
                      {item.nipt ? (
                        <Text style={{ color: colors.muted, fontSize: 12 }}>NIPT: {item.nipt}</Text>
                      ) : null}
                      {item.address ? (
                        <Text style={{ color: colors.muted, fontSize: 12 }}>{item.address}</Text>
                      ) : null}
                      {item.phone ? (
                        <Text style={{ color: colors.muted, fontSize: 12 }}>{item.phone}</Text>
                      ) : null}
                      {!isActive && item.status === "active" ? (
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>
                          Trokit për ta bërë aktive
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                      <Pressable onPress={() => openEdit(item)} hitSlop={8}>
                        <IconSymbol name="pencil" size={18} color={colors.primary} />
                      </Pressable>
                      <Pressable onPress={() => toggleStatus(item)} hitSlop={8}>
                        <IconSymbol
                          name={item.status === "active" ? "pause.circle.fill" : "play.circle.fill"}
                          size={20}
                          color={item.status === "active" ? colors.muted : colors.success}
                        />
                      </Pressable>
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={{ color: colors.muted, textAlign: "center", padding: 20 }}>Asnjë kompani.</Text>
          }
        />
      </ScreenContainer>
    </>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={{
          color: colors.foreground,
          fontSize: 16,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      />
    </View>
  );
}
