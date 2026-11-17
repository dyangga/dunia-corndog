"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CheckCircle2,
  LoaderCircle,
  Power,
  PowerOff,
  TriangleAlert,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "./ui/alert-dialog";

type Confirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  action: () => void | Promise<unknown>;
};
const ConfirmationContext = createContext<
  ((confirmation: Confirmation) => void) | null
>(null);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const trigger = useRef<HTMLElement | null>(null);
  const confirm = useCallback((next: Confirmation) => {
    if (pending.current) return;
    trigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setError("");
    setConfirmation(next);
    setOpen(true);
  }, []);
  async function execute() {
    if (!confirmation || !open || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await confirmation.action();
      setOpen(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Perubahan belum tersimpan. Silakan coba lagi.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <ConfirmationContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(open) => {
          if (!open && !pending.current) setOpen(false);
        }}
      >
        <AlertDialogContent
          onEscapeKeyDown={(event) => {
            if (pending.current) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            if (trigger.current?.isConnected) {
              event.preventDefault();
              trigger.current.focus();
            }
          }}
          aria-busy={busy}
        >
          <span
            className={`confirmation-symbol ${confirmation?.destructive ? "is-destructive" : ""}`}
            aria-hidden="true"
          >
            {confirmation?.destructive ? (
              <TriangleAlert size={23} />
            ) : (
              <CheckCircle2 size={23} />
            )}
          </span>
          <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {confirmation?.description}
          </AlertDialogDescription>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="confirmation-actions">
            <AlertDialogCancel asChild>
              <Button variant="outline" disabled={busy}>
                Batal
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant={confirmation?.destructive ? "destructive" : "default"}
                disabled={busy}
                onClick={(event) => {
                  event.preventDefault();
                  void execute();
                }}
              >
                {busy && (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                )}
                {busy ? "Menyimpan…" : confirmation?.confirmLabel}
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  const confirm = useContext(ConfirmationContext);
  if (!confirm) throw new Error("ConfirmationProvider is required");
  return confirm;
}

export function StatusActionButton({
  active,
  name,
  kind,
  description,
  onConfirm,
  beforeConfirm,
  size = "sm",
}: {
  active: boolean;
  name: string;
  kind: "menu" | "cabang" | "akun staf";
  description: string;
  onConfirm: () => void | Promise<unknown>;
  beforeConfirm?: () => boolean;
  size?: "sm" | "default";
}) {
  const confirm = useConfirmation();
  const label = active ? "Nonaktifkan" : "Aktifkan";
  const Icon = active ? PowerOff : Power;
  return (
    <Button
      variant={active ? "danger-outline" : "soft"}
      size={size}
      onClick={() => {
        if (beforeConfirm && !beforeConfirm()) return;
        confirm({
          title: `${label} ${kind}?`,
          description: `“${name}” ${description}`,
          confirmLabel: `${label} ${kind}`,
          destructive: active,
          action: onConfirm,
        });
      }}
    >
      <Icon aria-hidden="true" />
      {label}
    </Button>
  );
}
