"use client";
import { useMemo, useRef, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createApiClient,
  ApiError,
  type SessionResponse,
  type State,
} from "@dc/contracts";
import dynamic from "next/dynamic";
const App = dynamic(() => import("./app"), {
  loading: () => (
    <div className="connection-state" role="status">
      Memuat ruang usaha…
    </div>
  ),
});
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Field } from "./business-ui";
import { Flame, ArrowRight, LogOut } from "lucide-react";
import Corndog from "./corndog";
export default function OwnerShell({
  initialPage = "dashboard",
}: {
  initialPage?: string;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: true },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ConnectedOwner initialPage={initialPage} />
    </QueryClientProvider>
  );
}
function ConnectedOwner({ initialPage }: { initialPage: string }) {
  const queryClient = useQueryClient();
  const auth = useRef<{ csrfToken?: string }>({});
  const request = useMemo(
    () =>
      createApiClient(
        process.env.NEXT_PUBLIC_API_URL || "/api/v1",
        () => auth.current,
      ),
    [],
  );
  const session = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        const result = await request<SessionResponse>("/auth/me");
        auth.current.csrfToken = result.csrfToken;
        return result;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
  });
  const data = useQuery({
    queryKey: ["owner-state", session.data?.user.id],
    enabled: session.data?.user.role === "OWNER",
    queryFn: async () => {
      try {
        return await request<State>("/owner/state");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          auth.current = {};
          queryClient.setQueryData(["session"], null);
          queryClient.removeQueries({ queryKey: ["owner-state"] });
        }
        throw e;
      }
    },
    refetchInterval: 20000,
    refetchIntervalInBackground: false,
  });
  const logout = async () => {
    await request("/auth/logout", { method: "POST" });
    auth.current = {};
    queryClient.clear();
    queryClient.setQueryData(["session"], null);
    history.replaceState({}, "", "/login");
  };
  if (session.isPending)
    return (
      <div className="connection-state" role="status">
        Memeriksa sesi…
      </div>
    );
  if (session.isError)
    return (
      <div className="connection-state">
        <h1>API belum terhubung</h1>
        <p>{session.error.message}</p>
        <Button onClick={() => session.refetch()}>Coba lagi</Button>
      </div>
    );
  if (!session.data)
    return (
      <Login
        request={request}
        onSuccess={(result) => {
          auth.current.csrfToken = result.csrfToken;
          queryClient.setQueryData(["session"], result);
          history.replaceState({}, "", "/dashboard");
        }}
      />
    );
  if (session.data.user.role !== "OWNER")
    return (
      <div className="connection-state">
        <Flame size={32} />
        <h1>Akun kasir</h1>
        <p>
          Halo, {session.data.user.name}. Gunakan aplikasi Expo Dunia Corndog
          untuk membuka shift dan melayani pesanan.
        </p>
        <Button onClick={logout}>
          <LogOut size={16} />
          Keluar
        </Button>
      </div>
    );
  if (data.isPending)
    return (
      <div className="connection-state" role="status">
        Memuat ruang usaha…
      </div>
    );
  if (!data.data)
    return (
      <div className="connection-state">
        <h1>Data belum tersedia</h1>
        <p>{data.error?.message}</p>
        <Button onClick={() => data.refetch()}>Coba lagi</Button>
        <Button variant="ghost" onClick={logout}>
          Keluar
        </Button>
      </div>
    );
  return (
    <App
      initialPage={
        ["login", "pos", "queue"].includes(initialPage)
          ? "dashboard"
          : initialPage
      }
      connected={{
        state: data.data,
        user: session.data.user,
        request,
        refresh: () => data.refetch({ throwOnError: true }),
        logout,
        updatedAt: data.dataUpdatedAt,
        stale: data.isError,
      }}
    />
  );
}
function Login({
  request,
  onSuccess,
}: {
  request: ReturnType<typeof createApiClient>;
  onSuccess: (session: SessionResponse) => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="login-screen">
      <div className="login-brand">
        <div className="brand-icon">
          <Flame />
        </div>
        <h1>
          Dunia Corndog<span>Pencatatan keuangan dan operasional usaha.</span>
        </h1>
        <Corndog id="login-live" />
      </div>
      <form
        id="main-content"
        className="login-form wrap"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            const result = await request<SessionResponse>("/auth/login", {
              method: "POST",
              body: {
                username: form.get("username"),
                password: form.get("password"),
                client: "web",
              },
            });
            onSuccess(result);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="eyebrow">Ruang usaha Dunia Corndog</span>
        <h2>Masuk ke ruang usaha</h2>
        <p>Gunakan akun owner. Akun kasir digunakan pada aplikasi tablet.</p>
        <Field label="Username">
          <Input
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            required
            placeholder="Username akun"
          />
        </Field>
        <Field label="Password">
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Masukkan password"
          />
        </Field>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Memeriksa akun…" : "Masuk"}
          <ArrowRight size={17} />
        </Button>
      </form>
    </div>
  );
}
