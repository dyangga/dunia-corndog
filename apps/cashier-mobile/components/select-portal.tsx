import { createContext } from "react";

// Each native dialog owns its portal so select menus stay above the dialog.
export const SelectPortal = createContext<{
  hostName: string;
  container: HTMLElement | null;
  registerClose: (close: () => void) => () => void;
} | null>(null);
