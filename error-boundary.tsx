import React from "react";
import { ScrollView, Text, View, Pressable } from "react-native";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Catches any render-time error in the React tree and shows a readable
 * fallback screen instead of letting the Android process crash and close.
 *
 * In production builds (signed APK) an unhandled JS error during the very
 * first render makes the OS kill the activity, which is what users see as
 * "open and immediately close". With this boundary at the root the user can
 * at least read the error and recover by closing/reopening the app.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.warn("[Sistemi Genit] root error:", error?.message, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    const e = this.state.error;
    return (
      <View style={{ flex: 1, backgroundColor: "#fff", padding: 24 }}>
        <Text style={{ fontSize: 22, fontWeight: "900", color: "#dc2626", marginTop: 60 }}>
          Diçka shkoi keq
        </Text>
        <Text style={{ marginTop: 8, color: "#374151" }}>
          Aplikacioni Sistemi Genit hasi një gabim gjatë nisjes.
        </Text>
        <ScrollView
          style={{
            marginTop: 16,
            padding: 12,
            backgroundColor: "#f3f4f6",
            borderRadius: 8,
            maxHeight: 320,
          }}
        >
          <Text style={{ fontFamily: "monospace", color: "#111827", fontSize: 12 }}>
            {String(e?.message || e)}
          </Text>
          {e?.stack ? (
            <Text style={{ fontFamily: "monospace", color: "#6b7280", fontSize: 11, marginTop: 8 }}>
              {String(e.stack).split("\n").slice(0, 12).join("\n")}
            </Text>
          ) : null}
        </ScrollView>
        <Pressable
          onPress={this.reset}
          style={({ pressed }) => ({
            marginTop: 18,
            backgroundColor: "#dc2626",
            paddingVertical: 14,
            borderRadius: 10,
            alignItems: "center",
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>Provo përsëri</Text>
        </Pressable>
      </View>
    );
  }
}
