import type { SessionUser, State } from "@dc/contracts";
export type Connection = {
  state: State;
  user: SessionUser;
  request: <T>(
    path: string,
    options?: { method?: string; body?: unknown; key?: string },
  ) => Promise<T>;
  refresh: () => Promise<unknown>;
  logout: () => Promise<void>;
  updatedAt: number;
  stale: boolean;
};
