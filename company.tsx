import React from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Header, Btn, Field } from "@/components/ui-kit";
import { router } from "expo-router";
import { useStore } from "@/lib/store";

export default function CompanyScreen() {
  const colors = useColors();
  const { db, setDB } = useStore();
  const c = db.company;

  const [name, setName] = React.useState(c.name || "");
  const [address, setAddress] = React.useState(c.address || "");
  const [city, setCity] = React.useState(c.city || "");
  const [phone, setPhone] = React.useState(c.phone || "");
  const [email, setEmail] = React.useState(c.email || "");
  const [nipt, setNipt] = React.useState(c.nipt || "");
  const [currency, setCurrency] = React.useState(c.currency || "LEK");
  const [footer, setFooter] = React.useState(c.footer || "");
  const [listNames, setListNames] = React.useState<string[]>(() => {
    const base = c.priceListNames || [];
    return Array.from({ length: 10 }, (_, i) => base[i] || `Lista ${i + 1}`);
  });

  const save = async () => {
    if (!name.trim()) {
      Alert.alert("Emri", "Emri eshte i detyrueshem.");
      return;
    }
    await setDB({
      ...db,
      company: {
        ...c,
        name: name.trim(),
        address,
        city,
        phone,
        email,
        nipt,
        currency: currency.trim() || "LEK",
        footer,
        priceListNames: listNames.map((n, i) => n.trim() || `Lista ${i + 1}`),
      },
    });
    Alert.alert("OK", "Profili u ruajt.");
    router.back();
  };

  return (
    <ScreenContainer>
      <Header title="Profili i kompanise" back={() => router.back()} />
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
          <Text style={{ color: colors.primary, fontWeight: "800" }}>Si shfaqet ne fatura</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
            Te dhenat e meposhtme do te shfaqen ne kreun e cdo fature te shtypur.
          </Text>
        </View>
        <Field label="Emri i biznesit *" value={name} onChangeText={setName} />
        <Field label="Adresa" value={address} onChangeText={setAddress} />
        <Field label="Qyteti" value={city} onChangeText={setCity} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Field containerStyle={{ flex: 1 }} label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field containerStyle={{ flex: 1 }} label="NIPT" value={nipt} onChangeText={setNipt} />
        </View>
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Field label="Monedha" value={currency} onChangeText={setCurrency} />
        <Field label="Footer (mesazh ne fund te fatures)" value={footer} onChangeText={setFooter} />

        <Text style={{ color: colors.muted, fontWeight: "800", marginTop: 8, marginBottom: 4 }}>
          Emrat e 10 listave te cmimeve
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
          Keto emra perdoren ne artikuj, te klientet dhe te shitja (psh Pakice, Shumice, Kafe Korca).
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {listNames.map((n, i) => (
            <Field
              key={i}
              containerStyle={{ width: "47%" }}
              label={`Lista ${i + 1}`}
              value={n}
              onChangeText={(v) => setListNames((arr) => arr.map((x, j) => (j === i ? v : x)))}
            />
          ))}
        </View>
        <Btn fullWidth title="Ruaj" onPress={save} />
      </ScrollView>
    </ScreenContainer>
  );
}
