import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import {
  createApiClient,
  ApiError,
  type SessionUser,
  type SessionResponse,
} from "@dc/contracts";
const TOKEN_KEY = "dc.cashier.session";
const URL = process.env.EXPO_PUBLIC_API_URL;
const Context = createContext<null | {
  user: SessionUser | null;
  loading: boolean;
  error: string;
  request: ReturnType<typeof createApiClient>;
  signIn: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const token = useRef<string | undefined>(undefined);
  const qc = useQueryClient();
  const request = useMemo(() => {
    const client = createApiClient(
      URL || "http://localhost:4000/api/v1",
      () => ({ token: token.current }),
    );
    return async <T,>(
      path: string,
      options?: Parameters<typeof client>[1],
    ): Promise<T> => {
      try {
        return await client<T>(path, options);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          token.current = undefined;
          setUser(null);
          qc.clear();
          if (Platform.OS !== "web")
            await SecureStore.deleteItemAsync(TOKEN_KEY);
          await clearDrafts();
        }
        throw e;
      }
    };
  }, [qc]);
  async function clearDrafts(includePending = false) {
    const keys = (await AsyncStorage.getAllKeys()).filter(
      (k) =>
        k.startsWith("dc.draft.") ||
        (includePending && k.startsWith("dc.pending.")),
    );
    if (keys.length) await AsyncStorage.multiRemove(keys);
  }
  useEffect(() => {
    void (async () => {
      try {
        if (!URL)
          setError(
            "Atur EXPO_PUBLIC_API_URL agar tablet mengarah ke API Express pada komputer/server.",
          );
        if (Platform.OS !== "web")
          token.current =
            (await SecureStore.getItemAsync(TOKEN_KEY)) || undefined;
        if (token.current) {
          const session = await request<SessionResponse>("/auth/me");
          if (session.user.role === "CASHIER") setUser(session.user);
          else token.current = undefined;
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [request]);
  async function signIn(username: string, password: string) {
    setError("");
    if (!URL) throw new Error("EXPO_PUBLIC_API_URL belum diatur.");
    const result = await request<SessionResponse>("/auth/login", {
      method: "POST",
      body: { username, password, client: "native" },
    });
    token.current = result.token;
    if (result.user.role !== "CASHIER") {
      await request("/auth/logout", { method: "POST" });
      token.current = undefined;
      throw new Error("Gunakan akun kasir yang dibuat owner.");
    }
    if (Platform.OS !== "web")
      await SecureStore.setItemAsync(TOKEN_KEY, result.token!);
    setUser(result.user);
  }
  async function logout() {
    try {
      await request("/auth/logout", { method: "POST" });
    } catch {
      /* Local logout remains available offline. */
    } finally {
      token.current = undefined;
      if (Platform.OS !== "web") await SecureStore.deleteItemAsync(TOKEN_KEY);
      await clearDrafts(true);
      qc.clear();
      setUser(null);
    }
  }
  return (
    <Context.Provider value={{ user, loading, error, request, signIn, logout }}>
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error("SessionProvider missing");
  return value;
}
