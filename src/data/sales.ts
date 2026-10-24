// src/data/sales.ts
// منطق فاتورة البيع بالتشكيلة — دوال نقية (Pure Functions) من غير أي واجهة.
// القاعدة الأساسية: كل لون في الفاتورة بيطلع من طبخة واحدة، عشان درجة اللون تبقى واحدة عند المصنع.
// في النسخة الحقيقية نفس القواعد دي هتتنفذ في Django جوه transaction.atomic مع select_for_update على التواب.
import type { CashTransaction, DemoDataset, DyeLot, Roll, SalesInvoice, SalesLine, WarehouseId } from "./types";
import type { Indexes } from "./selectors";
import { customerBalances } from "./selectors";
import { fmtMoney, fmtQty } from "@/lib/format";

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ───────────── المتاح في المخزن ───────────── */

export interface LotStock {
  lot: DyeLot;
  /** التواب المتاحة من الطبخة دي في المخزن، مترتبة بالكود */
  rolls: Roll[];
}

/** item|color → الطبخات المتاحة (الأقدم الأول — FIFO) */
export type AvailabilityIndex = Map<string, LotStock[]>;

export const availKey = (itemId: string, colorId: string) => `${itemId}|${colorId}`;

export function buildAvailability(ds: DemoDataset, ix: Indexes, wh: WarehouseId): AvailabilityIndex {
  const byLot = new Map<string, Roll[]>();
  for (const r of ds.rolls) {
    if (r.status !== "available" || r.warehouseId !== wh) continue;
    const list = byLot.get(r.lotId);
    if (list) list.push(r);
    else byLot.set(r.lotId, [r]);
  }
  const index: AvailabilityIndex = new Map();
  for (const [lotId, rolls] of byLot) {
    const lot = ix.lotById.get(lotId);
    if (!lot) continue;
    rolls.sort((a, b) => (a.code < b.code ? -1 : 1));
    const k = availKey(lot.itemId, lot.colorId);
    const list = index.get(k) ?? [];
    list.push({ lot, rolls });
    index.set(k, list);
  }
  for (const list of index.values()) list.sort((a, b) => (a.lot.receivedOn < b.lot.receivedOn ? -1 : a.lot.code < b.lot.code ? -1 : 1));
  return index;
}

/** عدد التواب المتاحة من لون معيّن في مخزن (لعرض "متاح في المخزن التاني") */
export function countAvailable(index: AvailabilityIndex, itemId: string, colorId: string): number {
  return (index.get(availKey(itemId, colorId)) ?? []).reduce((s, l) => s + l.rolls.length, 0);
}

/** الطبخة الافتراضية: الأقدم اللي فيها العدد المطلوب، وإلا الأكبر */
export function defaultLot(lots: LotStock[], wanted: number): LotStock | undefined {
  return lots.find((l) => l.rolls.length >= wanted) ?? lots.reduce<LotStock | undefined>((best, l) => (!best || l.rolls.length > best.rolls.length ? l : best), undefined);
}

/* ───────────── مسودة الفاتورة ───────────── */

export interface DraftColorPick {
  colorId: string;
  lotId: string;
  rollIds: string[];
}

export interface DraftGroup {
  itemId: string;
  unitPrice: number;
  picks: DraftColorPick[];
}

export interface InvoiceDraft {
  warehouseId: WarehouseId;
  customerId: string;
  groups: DraftGroup[];
  discount: number;
  paidNow: number;
  createdBy: string;
}

export interface DraftTotals {
  rolls: number;
  meters: number;
  kilos: number;
  gross: number;
  cost: number;
  net: number;
}

export function draftTotals(groups: DraftGroup[], discount: number, ix: Indexes): DraftTotals {
  let rolls = 0;
  let meters = 0;
  let kilos = 0;
  let gross = 0;
  let cost = 0;
  for (const g of groups) {
    const item = ix.itemById.get(g.itemId);
    for (const p of g.picks) {
      const qty = p.rollIds.reduce((s, id) => s + (ix.rollById.get(id)?.quantity ?? 0), 0);
      rolls += p.rollIds.length;
      if (item?.unit === "kg") kilos += qty;
      else meters += qty;
      gross += round2(qty * g.unitPrice);
      cost += qty * (ix.lotById.get(p.lotId)?.unitCost ?? 0);
    }
  }
  gross = round2(gross);
  return { rolls, meters, kilos, gross, cost: round2(cost), net: round2(Math.max(0, gross - discount)) };
}

export function nextInvoiceNumber(ds: DemoDataset): number {
  let max = 0;
  for (const inv of ds.salesInvoices) {
    const n = Number(inv.number.replace(/\D/g, ""));
    if (n > max) max = n;
  }
  return max + 1;
}

/* ───────────── حفظ الفاتورة ───────────── */

export class InvoiceError extends Error {}

export interface CommitResult {
  ds: DemoDataset;
  invoice: SalesInvoice;
}

/**
 * بيحفظ الفاتورة ويرجّع نسخة جديدة من البيانات (Immutable Update):
 * التواب بتتعلّم "مُباعة"، والفاتورة بتتضاف، والنقدي بيتسجل في خزنة المخزن.
 * رصيد العميل بيتحسب تلقائياً من الفواتير والتحصيلات (مفيش رصيد متخزّن يتلخبط).
 */
export function commitInvoice(ds: DemoDataset, ix: Indexes, draft: InvoiceDraft): CommitResult {
  const customer = ix.customerById.get(draft.customerId);
  if (!customer) throw new InvoiceError("اختار العميل الأول.");

  const groups = draft.groups
    .map((g) => ({ ...g, picks: g.picks.filter((p) => p.rollIds.length > 0) }))
    .filter((g) => g.picks.length > 0);
  if (groups.length === 0) throw new InvoiceError("الفاتورة فاضية — ضيف صنف واحد على الأقل.");

  const seen = new Set<string>();
  const lines: SalesLine[] = [];
  for (const g of groups) {
    const item = ix.itemById.get(g.itemId);
    if (!item) throw new InvoiceError("صنف غير معروف.");
    if (!(g.unitPrice > 0)) throw new InvoiceError(`سعر ${item.name} لازم يكون أكبر من صفر.`);
    for (const p of g.picks) {
      const lot = ix.lotById.get(p.lotId);
      if (!lot) throw new InvoiceError("طبخة غير معروفة.");
      let qty = 0;
      for (const id of p.rollIds) {
        const r = ix.rollById.get(id);
        if (!r || r.status !== "available" || r.warehouseId !== draft.warehouseId) {
          throw new InvoiceError(`التوب ${r?.code ?? id} مش متاح في المخزن ده — يمكن اتباع من شوية.`);
        }
        if (r.lotId !== p.lotId || r.colorId !== p.colorId || r.itemId !== g.itemId) {
          throw new InvoiceError(`التوب ${r.code} مش من نفس الطبخة — مينفعش نخلط طبختين في نفس اللون.`);
        }
        if (seen.has(id)) throw new InvoiceError(`التوب ${r.code} متكرر في الفاتورة.`);
        seen.add(id);
        qty += r.quantity;
      }
      qty = round2(qty);
      lines.push({
        itemId: g.itemId,
        colorId: p.colorId,
        lotId: p.lotId,
        rollIds: [...p.rollIds],
        quantity: qty,
        unitPrice: g.unitPrice,
        total: round2(qty * g.unitPrice),
        cost: round2(qty * lot.unitCost),
      });
    }
  }

  const gross = round2(lines.reduce((s, l) => s + l.total, 0));
  const discount = round2(Math.max(0, draft.discount || 0));
  if (discount > gross) throw new InvoiceError("الخصم أكبر من إجمالي الفاتورة.");
  const total = round2(gross - discount);
  const paidNow = round2(Math.max(0, draft.paidNow || 0));
  if (paidNow > total) throw new InvoiceError("المدفوع أكبر من صافي الفاتورة.");

  const n = nextInvoiceNumber(ds);
  const invoice: SalesInvoice = {
    id: `inv-${n}`,
    number: `INV-${n}`,
    date: ds.today,
    warehouseId: draft.warehouseId,
    customerId: customer.id,
    lines,
    total,
    cost: round2(lines.reduce((s, l) => s + l.cost, 0)),
    paidNow,
    rollCount: seen.size,
    discount: discount > 0 ? discount : undefined,
    createdBy: draft.createdBy,
  };

  const rolls = ds.rolls.map((r) =>
    seen.has(r.id) ? { ...r, status: "sold" as const, soldOn: ds.today, invoiceId: invoice.id } : r,
  );

  const cash: CashTransaction[] =
    paidNow > 0
      ? [
          ...ds.cash,
          {
            id: `cash-u-${n}`,
            date: ds.today,
            warehouseId: draft.warehouseId,
            kind: "cash_sale",
            amount: paidNow,
            note: `نقدي فاتورة ${invoice.number} — ${customer.name}`,
            partyId: customer.id,
          },
        ]
      : ds.cash;

  return {
    ds: { ...ds, rolls, salesInvoices: [...ds.salesInvoices, invoice], cash },
    invoice,
  };
}

/* ───────────── العميل ───────────── */

export function customerBalance(ds: DemoDataset, customerId: string): number {
  return customerBalances(ds).get(customerId)?.balance ?? 0;
}

/* ───────────── ملخص نصي للفاتورة (للنسخ على واتساب) ───────────── */

export function invoiceText(inv: SalesInvoice, ix: Indexes, businessName: string): string {
  const customer = ix.customerById.get(inv.customerId)?.name ?? "";
  const out: string[] = [`*${businessName}*`, `فاتورة ${inv.number} — ${inv.date}`, `العميل: ${customer}`, ""];
  const byItem = new Map<string, SalesLine[]>();
  for (const l of inv.lines) byItem.set(l.itemId, [...(byItem.get(l.itemId) ?? []), l]);
  for (const [itemId, lines] of byItem) {
    const item = ix.itemById.get(itemId);
    const unit = item?.unit === "kg" ? "كجم" : "م";
    out.push(`▪ ${item?.name ?? ""} — ${fmtMoney(lines[0]?.unitPrice ?? 0)} لل${item?.unit === "kg" ? "كيلو" : "متر"}`);
    for (const l of lines) {
      const color = ix.colorById.get(l.colorId)?.name ?? "";
      const lot = ix.lotById.get(l.lotId)?.code ?? "";
      out.push(`   ${color} · طبخة ${lot} · ${l.rollIds.length} توب · ${fmtQty(l.quantity)} ${unit} = ${fmtMoney(l.total)}`);
    }
  }
  out.push("");
  if (inv.discount) out.push(`خصم: ${fmtMoney(inv.discount)}`);
  out.push(`الصافي: ${fmtMoney(inv.total)}`);
  out.push(`المدفوع: ${fmtMoney(inv.paidNow)}`);
  if (inv.total - inv.paidNow > 0) out.push(`الباقي آجل: ${fmtMoney(inv.total - inv.paidNow)}`);
  return out.join("\n");
}
