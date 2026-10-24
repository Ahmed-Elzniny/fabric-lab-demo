// src/data/transfers.ts
// منطق التحويلات بين المخازن — دوال نقية (Pure Functions).
// تحويل البضاعة: التواب بتخرج من المخزن المرسِل وبتبقى "في الطريق" لحد ما المخزن المستلم يأكد الاستلام.
// تحويل النقدية: قيدين في نفس اللحظة — صادر من خزنة ووارد في التانية.
// في النسخة الحقيقية: Django transaction.atomic + select_for_update على التواب والخزنة.
import type { DraftGroup } from "./sales";
import type { Indexes } from "./selectors";
import { cashBoxBalance } from "./selectors";
import type { CashTransaction, DemoDataset, StockTransfer, WarehouseId } from "./types";

const WH_NAME: Record<WarehouseId, string> = { kerdasa: "كرداسة", mahalla: "المحلة" };

export class TransferError extends Error {}

export interface TransferDraft {
  fromWarehouseId: WarehouseId;
  toWarehouseId: WarehouseId;
  groups: DraftGroup[];
  driver: string;
  note: string;
  createdBy: string;
}

export function nextTransferNumber(ds: DemoDataset): number {
  let max = 0;
  for (const t of ds.transfers) {
    const n = Number(t.number.replace(/\D/g, ""));
    if (n > max) max = n;
  }
  return max + 1;
}

export function commitTransfer(ds: DemoDataset, ix: Indexes, draft: TransferDraft): { ds: DemoDataset; transfer: StockTransfer } {
  if (draft.fromWarehouseId === draft.toWarehouseId) throw new TransferError("المخزن المرسِل والمستلم لازم يكونوا مختلفين.");
  if (!draft.driver.trim()) throw new TransferError("اكتب اسم السواق أو شركة الشحن.");

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const g of draft.groups) {
    for (const p of g.picks) {
      for (const id of p.rollIds) {
        const r = ix.rollById.get(id);
        if (!r || r.status !== "available" || r.warehouseId !== draft.fromWarehouseId) {
          throw new TransferError(`التوب ${r?.code ?? id} مش متاح في مخزن ${WH_NAME[draft.fromWarehouseId]}.`);
        }
        if (r.lotId !== p.lotId) throw new TransferError(`التوب ${r.code} مش من الطبخة المختارة.`);
        if (seen.has(id)) throw new TransferError(`التوب ${r.code} متكرر في التحويل.`);
        seen.add(id);
        ids.push(id);
      }
    }
  }
  if (ids.length === 0) throw new TransferError("التحويل فاضي — اختار تواب الأول.");

  const n = nextTransferNumber(ds);
  const transfer: StockTransfer = {
    id: `tr-${n}`,
    number: `TR-${n}`,
    date: ds.today,
    fromWarehouseId: draft.fromWarehouseId,
    toWarehouseId: draft.toWarehouseId,
    rollIds: ids,
    status: "in_transit",
    driver: draft.driver.trim(),
    note: draft.note.trim() || undefined,
    createdBy: draft.createdBy,
  };
  // نفس اصطلاح البيانات: التوب اللي في الطريق متسجّل على المخزن المستلم بحالة in_transit
  const rolls = ds.rolls.map((r) => (seen.has(r.id) ? { ...r, status: "in_transit" as const, warehouseId: draft.toWarehouseId } : r));
  return { ds: { ...ds, rolls, transfers: [...ds.transfers, transfer] }, transfer };
}

export function receiveTransfer(ds: DemoDataset, transferId: string, receivedBy: string): { ds: DemoDataset; transfer: StockTransfer } {
  const t = ds.transfers.find((x) => x.id === transferId);
  if (!t) throw new TransferError("التحويل مش موجود.");
  if (t.status !== "in_transit") throw new TransferError(`التحويل ${t.number} اتسلم قبل كده.`);
  const ids = new Set(t.rollIds);
  const updated: StockTransfer = { ...t, status: "received", receivedOn: ds.today, receivedBy };
  const rolls = ds.rolls.map((r) => (ids.has(r.id) ? { ...r, status: "available" as const, warehouseId: t.toWarehouseId } : r));
  return {
    ds: { ...ds, rolls, transfers: ds.transfers.map((x) => (x.id === t.id ? updated : x)) },
    transfer: updated,
  };
}

export interface CashTransferDraft {
  fromWarehouseId: WarehouseId;
  toWarehouseId: WarehouseId;
  amount: number;
  note: string;
  createdBy: string;
}

export function commitCashTransfer(ds: DemoDataset, draft: CashTransferDraft): DemoDataset {
  const { fromWarehouseId: from, toWarehouseId: to } = draft;
  if (from === to) throw new TransferError("الخزنتين لازم يكونوا مختلفين.");
  const amount = Math.round(draft.amount * 100) / 100;
  if (!(amount > 0)) throw new TransferError("اكتب مبلغ أكبر من صفر.");
  const available = cashBoxBalance(ds, from);
  if (amount > available) {
    throw new TransferError(`رصيد خزنة ${WH_NAME[from]} ${Math.round(available).toLocaleString("en-US")} ج.م بس.`);
  }
  const stamp = `${ds.cash.length + 1}`;
  const note = draft.note.trim();
  const out: CashTransaction = {
    id: `cash-u-tout-${stamp}`,
    date: ds.today,
    warehouseId: from,
    kind: "cash_transfer_out",
    amount: -amount,
    note: `تحويل نقدية إلى خزنة ${WH_NAME[to]}${note ? ` — ${note}` : ""}`,
  };
  const inn: CashTransaction = {
    id: `cash-u-tin-${stamp}`,
    date: ds.today,
    warehouseId: to,
    kind: "cash_transfer_in",
    amount,
    note: `تحويل نقدية من خزنة ${WH_NAME[from]}${note ? ` — ${note}` : ""}`,
  };
  return { ...ds, cash: [...ds.cash, out, inn] };
}

/** ملخص محتوى التحويل: الأصناف والألوان والكمية بالوحدة الصح */
export interface TransferContents {
  rolls: number;
  meters: number;
  kilos: number;
  costValue: number;
  byItem: { itemId: string; name: string; colors: { colorId: string; name: string; hex: string; lotCode: string; rolls: string[]; qty: number }[] }[];
}

export function transferContents(t: StockTransfer, ix: Indexes): TransferContents {
  const out: TransferContents = { rolls: 0, meters: 0, kilos: 0, costValue: 0, byItem: [] };
  for (const id of t.rollIds) {
    const r = ix.rollById.get(id);
    if (!r) continue;
    const item = ix.itemById.get(r.itemId);
    const lot = ix.lotById.get(r.lotId);
    const color = ix.colorById.get(r.colorId);
    out.rolls++;
    if (item?.unit === "kg") out.kilos += r.quantity;
    else out.meters += r.quantity;
    out.costValue += r.quantity * (lot?.unitCost ?? 0);
    let g = out.byItem.find((x) => x.itemId === r.itemId);
    if (!g) {
      g = { itemId: r.itemId, name: item?.name ?? "", colors: [] };
      out.byItem.push(g);
    }
    let c = g.colors.find((x) => x.colorId === r.colorId && x.lotCode === lot?.code);
    if (!c) {
      c = { colorId: r.colorId, name: color?.name ?? "", hex: color?.hex ?? "#999", lotCode: lot?.code ?? "", rolls: [], qty: 0 };
      g.colors.push(c);
    }
    c.rolls.push(r.code);
    c.qty += r.quantity;
  }
  return out;
}
