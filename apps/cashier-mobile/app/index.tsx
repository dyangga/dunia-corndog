import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors as c } from "@dc/design-tokens";
import { useSession } from "../lib/session";
import { Button, Field, Heading, Notice, s } from "../components/ui";
import { Text } from "../components/typography";
import { AddedItem, Touch } from "../components/motion";
import Corndog from "../components/corndog";
import Cashier from "../features/cashier";
export default function Index() {
  const session = useSession();
  const wide = useWindowDimensions().width >= 900;
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [showPassword, setShowPassword] = useState(false);
  async function submit() {
    if (busy || !username || !password) return;
    setBusy(true);
    setError("");
    try {
      await session.signIn(username, password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (session.loading)
    return (
      <SafeAreaView style={[s.screen, { justifyContent: "center" }]}>
        <ActivityIndicator color={c.ink} />
      </SafeAreaView>
    );
  if (session.user) return <Cashier />;
  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: wide ? 36 : 20,
          }}
        >
          <View style={[l.shell, { flexDirection: wide ? "row" : "column" }]}>
            {wide && (
              <View style={l.brandPanel}>
                <View style={[s.row, { justifyContent: "flex-start" }]}>
                  <View style={l.logo}>
                    <Ionicons name="flame-outline" color="white" size={24} />
                  </View>
                  <Text style={l.brandName}>Dunia Corndog.</Text>
                </View>
                <View style={{ marginTop: 52 }}>
                  <Text style={s.eyebrow}>
                    DARI DAPUR, UNTUK HARI YANG RAMAI
                  </Text>
                  <Text style={l.heroTitle}>
                    Siap untuk{"\n"}pesanan pertama.
                  </Text>
                  <Text style={[s.muted, { marginTop: 16, maxWidth: 290 }]}>
                    Pilih ukuran, racik pesanan, dan layani pelanggan dari satu
                    tempat.
                  </Text>
                </View>
                <View style={l.illustrations}>
                  <View style={l.circle} />
                  <View style={{ transform: [{ rotate: "-12deg" }] }}>
                    <Corndog id="login-gold" width={150} height={190} />
                  </View>
                  <View
                    style={{
                      marginLeft: -24,
                      marginTop: 25,
                      transform: [{ rotate: "12deg" }],
                    }}
                  >
                    <Corndog
                      id="login-choco"
                      kind="choco"
                      width={130}
                      height={170}
                    />
                  </View>
                </View>
                <Text
                  style={{ fontSize: 11, color: c.muted, letterSpacing: 1.2 }}
                >
                  GURIH PEDAS / MANIS
                </Text>
              </View>
            )}
            <View style={[l.formPanel, { padding: wide ? 48 : 26 }]}>
              <AddedItem
                style={{ width: "100%", maxWidth: 390, alignSelf: "center" }}
              >
                {!wide && (
                  <View
                    style={[
                      s.row,
                      { justifyContent: "flex-start", marginBottom: 36 },
                    ]}
                  >
                    <View style={l.logo}>
                      <Ionicons name="flame-outline" color="white" size={24} />
                    </View>
                    <Text style={l.brandName}>Dunia Corndog.</Text>
                  </View>
                )}
                <Text style={s.eyebrow}>AKSES KASIR</Text>
                <Heading>Siap melayani?</Heading>
                <Text style={[s.muted, { marginBottom: 30, marginTop: 4 }]}>
                  Masuk dengan akun kasir yang diberikan owner.
                </Text>
                <Field
                  label="Username"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  placeholder="Username kasir"
                  returnKeyType="next"
                />
                <View>
                  <Field
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="current-password"
                    placeholder="Masukkan password"
                    onSubmitEditing={() => void submit()}
                    returnKeyType="go"
                    style={{ paddingRight: 54 }}
                  />
                  <Touch
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword
                        ? "Sembunyikan password"
                        : "Tampilkan password"
                    }
                    onPress={() => setShowPassword(!showPassword)}
                    style={l.passwordToggle}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={21}
                      color={c.muted}
                    />
                  </Touch>
                </View>
                {!!(error || session.error) && (
                  <Notice error>{error || session.error}</Notice>
                )}
                <View style={{ marginTop: 8 }}>
                  <Button
                    disabled={busy || !username || !password}
                    onPress={() => void submit()}
                  >
                    {busy ? "Memeriksa akun…" : "Masuk sebagai kasir"}
                  </Button>
                </View>
                <View style={[s.row, l.loginNote]}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={14}
                    color={c.muted}
                  />
                  <Text style={{ fontSize: 12, color: c.muted, flexShrink: 1 }}>
                    Akun dan akses cabang diatur oleh owner.
                  </Text>
                </View>
              </AddedItem>
            </View>
          </View>
          <Text
            style={{
              textAlign: "center",
              fontSize: 11,
              letterSpacing: 0.6,
              color: c.muted,
              marginTop: 22,
            }}
          >
            Dunia Corndog · Kasir tablet
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const l = StyleSheet.create({
  shell: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: c.surface,
  },
  brandPanel: {
    width: "46%",
    backgroundColor: "#F3EDE1",
    padding: 36,
    minHeight: 590,
  },
  formPanel: { flex: 1, justifyContent: "center" },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: c.red,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    fontSize: 20,
    fontWeight: "700",
    color: c.ink,
    letterSpacing: -0.6,
  },
  heroTitle: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "600",
    color: c.ink,
    letterSpacing: -1.8,
    marginTop: 8,
  },
  illustrations: {
    flex: 1,
    minHeight: 220,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
  },
  circle: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "#F9D987",
    opacity: 0.65,
  },
  passwordToggle: {
    position: "absolute",
    right: 2,
    top: 28,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  loginNote: {
    justifyContent: "center",
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: 24,
    marginTop: 28,
  },
});
