import { useState, type ReactNode } from "react";
import { Button } from "./ui/button";
export function PaginatedList<T>({
  items,
  pageKey = "",
  pageSize = 25,
  children,
}: {
  items: readonly T[];
  pageKey?: string;
  pageSize?: number;
  children: (items: T[]) => ReactNode;
}) {
  const [selection, setSelection] = useState({ key: pageKey, page: 0 });
  const page = Math.min(
    selection.key === pageKey ? selection.page : 0,
    Math.max(0, Math.ceil(items.length / pageSize) - 1),
  );
  const start = page * pageSize;
  return (
    <>
      {children(items.slice(start, start + pageSize))}
      {items.length > pageSize && (
        <div className="table-footer">
          <span>
            {start + 1}–{Math.min(start + pageSize, items.length)} dari{" "}
            {items.length}
          </span>
          <div className="button-group">
            <Button
              variant="outline"
              disabled={!page}
              onClick={() => setSelection({ key: pageKey, page: page - 1 })}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              disabled={start + pageSize >= items.length}
              onClick={() => setSelection({ key: pageKey, page: page + 1 })}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
