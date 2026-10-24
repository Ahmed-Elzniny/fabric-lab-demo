// src/features/sales/status.ts
import type { SalesInvoice } from "@/data/types";

export type InvoiceStatus = "paid" | "partial" | "credit";

export function invoiceStatus(inv: Pick<SalesInvoice, "paidNow" | "total">): InvoiceStatus {
  if (inv.paidNow >= inv.total - 0.5) return "paid";
  return inv.paidNow > 0 ? "partial" : "credit";
}

export const STATUS_META: Record<InvoiceStatus, { label: string; cls: string }> = {
  paid: { label: "مدفوعة", cls: "chip--good" },
  partial: { label: "جزء آجل", cls: "chip--warn" },
  credit: { label: "آجل", cls: "chip--info" },
};
