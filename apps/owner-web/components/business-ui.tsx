"use client";

import {
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
  type ComponentProps,
} from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

// Business compositions of the registry components. Keep primitives in ui/ reusable.
export function BusinessDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onCloseAutoFocus,
  closeDisabled = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onCloseAutoFocus?: ComponentProps<typeof DialogContent>["onCloseAutoFocus"];
  closeDisabled?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="business-dialog"
        showCloseButton={false}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader>
          <div className="dialog-heading">
            <div className="dialog-heading-copy">
              <DialogTitle className="dialog-title">{title}</DialogTitle>
              <DialogDescription className="dialog-description">
                {description ||
                  "Simulasi frontend. Perubahan hanya disimpan di browser ini."}
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="dialog-close"
                aria-label="Tutup dialog"
                disabled={closeDisabled}
              >
                <X size={20} />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>
        <ScrollArea className="dialog-scroll">
          <div className="dialog-body">{children}</div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
export function BusinessSelect({
  options,
  label,
  id,
  className,
  startIcon,
  ...props
}: Omit<ComponentProps<typeof Select>, "children"> & {
  options: { value: string; label: ReactNode }[];
  label?: string;
  id?: string;
  className?: string;
  startIcon?: ReactNode;
}) {
  return (
    <Select
      {...props}
      defaultValue={
        props.defaultValue ??
        (props.value === undefined ? options[0]?.value : undefined)
      }
      disabled={props.disabled || !options.length}
    >
      <SelectTrigger
        id={id}
        aria-label={label}
        className={`business-select ${className || ""}`}
      >
        {startIcon}
        <SelectValue placeholder="Pilih opsi" />
      </SelectTrigger>
      <SelectContent position="popper" className="business-select-content">
        {options.map((option) => (
          <SelectItem value={option.value} key={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function FilterTabs({
  value,
  onValueChange,
  options,
  label,
  children,
  className,
  icons,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  label: string;
  children: ReactNode;
  className?: string;
  icons?: Record<string, ReactNode>;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={onValueChange}
      className={`business-tabs ${className || ""}`}
    >
      <TabsList aria-label={label} className="tabs">
        {options.map((t) => (
          <TabsTrigger className="business-tab" key={t} value={t}>
            {icons?.[t] && (
              <span className="business-tab-icon" aria-hidden="true">
                {icons[t]}
              </span>
            )}
            {t}
          </TabsTrigger>
        ))}
      </TabsList>
      {options.map((t) => (
        <TabsContent key={t} value={t} className="business-tab-content">
          {value === t ? children : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}
export function StatusBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: string;
}) {
  const s = String(children);
  const status =
    tone ||
    (s === "Selesai" || s === "Aktif" || s === "Aman"
      ? "success"
      : s === "Refund" || s === "Habis" || s === "Nonaktif"
        ? "danger"
        : s === "Diproses" || s === "Menipis"
          ? "warning"
          : "neutral");
  return (
    <Badge variant="outline" className={`badge ${status}`}>
      <span className="badge-dot" />
      {children}
    </Badge>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  const control = isValidElement(children) && typeof children.type !== "string";
  return (
    <div className="field">
      {control ? (
        <>
          <Label htmlFor={id}>{label}</Label>
          {cloneElement(children as ReactElement<{ id?: string }>, { id })}
        </>
      ) : (
        <div role="group" aria-labelledby={id}>
          <Label asChild>
            <span id={id}>{label}</span>
          </Label>
          {children}
        </div>
      )}
    </div>
  );
}
