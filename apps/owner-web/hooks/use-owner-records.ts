import { useEffect, useState } from "react";
import type { Connection } from "@/lib/connection";
export function useOwnerRecords<T>(c: Connection, path: string) {
  const [selection, setSelection] = useState<{
    path: string;
    cursors: (string | undefined)[];
  }>({ path, cursors: [undefined] });
  const cursors = selection.path === path ? selection.cursors : [undefined];
  const cursor = cursors.at(-1),
    key = `${path}:${cursor || ""}`;
  const [result, setResult] = useState<{
    key: string;
    items: T[];
    nextCursor: string | null;
  }>();
  const [pending, setPending] = useState(true),
    [error, setError] = useState(""),
    [revision, retry] = useState(0);
  useEffect(() => {
    let active = true;
    setPending(true);
    setError("");
    c.request<{ items: T[]; nextCursor: string | null }>(
      `${path}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    )
      .then((data) => {
        if (active) {
          setResult({ ...data, key });
          setPending(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setPending(false);
        }
      });
    return () => {
      active = false;
    };
  }, [c.request, c.updatedAt, path, cursor, key, revision]);
  const current = result?.key === key ? result : undefined;
  return {
    items: current?.items || [],
    pending: pending || (!current && !error),
    error,
    hasNext: !!current?.nextCursor,
    page: cursors.length,
    next: () => {
      if (current?.nextCursor)
        setSelection({ path, cursors: [...cursors, current.nextCursor] });
    },
    previous: () => setSelection({ path, cursors: cursors.slice(0, -1) }),
    retry: () => retry((n) => n + 1),
  };
}
