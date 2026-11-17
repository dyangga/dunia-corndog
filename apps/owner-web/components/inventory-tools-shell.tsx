"use client";
import {
  memo,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import dynamic from "next/dynamic";
import type { Connection } from "@/lib/connection";
import { Button } from "./ui/button";
import {
  BookOpen,
  ChefHat,
  PackagePlus,
  SlidersHorizontal,
} from "lucide-react";
import type { InventoryTool } from "./inventory-tools";

const actions = [
  { key: "item", label: "Tambah bahan", icon: PackagePlus },
  { key: "recipe", label: "Atur resep", icon: BookOpen },
  { key: "minimum", label: "Batas stok minimum", icon: SlidersHorizontal },
  { key: "production", label: "Posting produksi", icon: ChefHat },
] as const;
const Tools = dynamic(() => import("./inventory-tools"), {
  loading: () => null,
});
export type InventoryToolsHandle = { open: (tool: InventoryTool) => void };
export default memo(function InventoryToolsShell({
  connected,
  ref,
}: {
  connected: Connection;
  ref?: Ref<InventoryToolsHandle>;
}) {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const [tool, setTool] = useState<InventoryTool>("item");
  const trigger = useRef<HTMLButtonElement | null>(null);
  const openTool = useCallback((next: InventoryTool) => {
    trigger.current =
      document.activeElement instanceof HTMLButtonElement
        ? document.activeElement
        : null;
    setTool(next);
    setOpened(true);
    setOpen(true);
  }, []);
  useImperativeHandle(ref, () => ({ open: openTool }), [openTool]);
  return (
    <>
      <div
        className="button-group inventory-tools-launcher"
        aria-label="Alat inventori"
      >
        {actions.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            aria-haspopup="dialog"
            onClick={() => openTool(key)}
          >
            <Icon aria-hidden="true" /> {label}
          </Button>
        ))}
      </div>
      {opened && (
        <Tools
          connected={connected}
          tool={tool}
          open={open}
          onOpenChange={setOpen}
          returnFocus={() => trigger.current?.focus()}
        />
      )}
    </>
  );
});
