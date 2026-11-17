import { replaceEqualDeep } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ReportOverview } from "@dc/contracts";
import type { Connection } from "@/lib/connection";

export function useOwnerReport(
  connection: Connection | undefined,
  from: string,
  to: string,
  branch: string,
  enabled: boolean,
) {
  const key = `${from}:${to}:${branch}`;
  const [revision, retry] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data?: ReportOverview;
    pending: boolean;
    updatedAt?: number;
    error?: string;
  }>({ key: "", pending: false });
  const request = connection?.request,
    updatedAt = connection?.updatedAt;
  useEffect(() => {
    if (!request || !enabled) return;
    let active = true;
    setResult((old) => ({
      key,
      data: old.key === key ? old.data : undefined,
      updatedAt: old.key === key ? old.updatedAt : undefined,
      pending: true,
    }));
    request<ReportOverview>(
      `/reports/overview?from=${from}&to=${to}${branch === "all" ? "" : `&branchId=${branch}`}`,
    )
      .then((data) => {
        if (active)
          setResult((old) => ({
            key,
            data: replaceEqualDeep(
              old.key === key ? old.data : undefined,
              data,
            ),
            pending: false,
            updatedAt: Date.now(),
          }));
      })
      .catch((e) => {
        if (active)
          setResult((old) => ({ ...old, pending: false, error: e.message }));
      });
    return () => {
      active = false;
    };
  }, [request, updatedAt, key, enabled, revision, from, to, branch]);
  const same = result.key === key;
  return {
    data: same ? result.data : undefined,
    updatedAt: same ? result.updatedAt : undefined,
    pending: !same || result.pending,
    error: same ? result.error : undefined,
    retry: () => retry((n) => n + 1),
  };
}
