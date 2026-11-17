import "../global.css";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, AppState, View } from "react-native";
import { useFonts } from "expo-font";
import { FontReady } from "../components/typography";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import { SessionProvider } from "../lib/session";
export default function Layout() {
  const [fontsReady, fontError] = useFonts({
    HostRegular: require("../assets/fonts/HostGrotesk-Regular.ttf"),
    HostMedium: require("../assets/fonts/HostGrotesk-Medium.ttf"),
    HostSemibold: require("../assets/fonts/HostGrotesk-Semibold.ttf"),
    HostBold: require("../assets/fonts/HostGrotesk-Bold.ttf"),
  });
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchIntervalInBackground: false,
          },
        },
      }),
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) =>
      focusManager.setFocused(state === "active"),
    );
    return () => sub.remove();
  }, []);
  if (!fontsReady && !fontError)
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FAF9F6",
        }}
      >
        <ActivityIndicator color="#292929" />
      </View>
    );
  return (
    <FontReady.Provider value={fontsReady}>
      <SafeAreaProvider>
        <QueryClientProvider client={client}>
          <SessionProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, animation: "none" }} />
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </FontReady.Provider>
  );
}
