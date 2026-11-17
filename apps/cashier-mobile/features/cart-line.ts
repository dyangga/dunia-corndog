import type { MenuSize } from "@dc/contracts";
export type CartLine = {
  key: string;
  skuId: string;
  productId: string;
  name: string;
  category: string;
  size: MenuSize;
  quantity: number;
  modifierIds: string[];
  modifiers: string[];
  note: string;
  unitPrice: number;
};
