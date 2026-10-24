// src/data/purchases.ts
// المشتريات: استلام طبخات جديدة من المصنع بأطوال/أوزان التواب الفعلية،
// وتوزيع مصاريف النقل والتحميل على تكلفة الطبخات (Landed Cost)، وأرصدة الموردين والسداد.
// في DRF: POST /api/purchases (transaction.atomic) ، GET /api/suppliers/balances ، POST /api/suppliers/{id}/payments
import type { IsoDate } from "@/lib/dates";
import type { Indexes, WarehouseFilter } from "./selectors";
import { cashBoxBalance, periodRange, type Period } from "./selectors";
import type { CashTransaction, DemoDataset, DyeLot, PurchaseInvoice, Roll, Supplier, WarehouseId } from "./types";

const WH: Record<WarehouseId, string> = { kerdasa: "كرداسة", mahalla: "المحلة" };
const r2 = (n: number) => Math.round(n * 100) / 100;

/* ───────────── أرصدة الموردين ───────────── */

export interface SupplierRow {
  supplier: Supplier;
  purchases: number;
  paid: number;
  balance: number;
  lastPurchase: IsoDate | null;
  lastPayment: IsoDate | null;
  invoices: number;
}

export function supplierRows(ds: DemoDataset): SupplierRow[] {
  const map = new Map<string, SupplierRow>(
    ds.suppliers.map((s) => [s.id, { supplier: s, purchases: 0, paid: 0, balance: 0, lastPurchase: null, lastPayment: null, invoices: 0 }]),
  );
  for (const p of ds.purchaseInvoices) {
    const row = map.get(p.supplierId);
    if (!row) continue;
    row.purchases += p.total;
    row.invoices++;
    if (!row.lastPurchase || p.date > row.lastPurchase) row.lastPurchase = p.date;
  }
  for (const t of ds.cash) {
    if (t.kind !== "supplier_payment" || !t.partyId) continue;
    const row = map.get(t.partyId);
    if (!row) continue;
    row.paid += -t.amount;
    if (!row.lastPayment || t.date > row.lastPayment) row.lastPayment = t.date;
  }
  for (const row of map.values()) row.balance = r2(row.purchases - row.paid);
  return [...map.values()].sort((a, b) => b.balance - a.balance);
}

/* ───────────── قائمة فواتير الشراء ───────────── */

export interface PurchaseRow {
  invoice: PurchaseInvoice;
  supplierName: string;
  lots: DyeLot[];
  rolls: number;
  meters: number;
  kilos: number;
  colors: string[];
  itemNames: string;
}

export function purchaseRows(ds: DemoDataset, ix: Indexes, f: WarehouseFilter, period: Period): PurchaseRow[] {
  const { current } = periodRange(ds.today, period);
  const supplierName = new Map(ds.suppliers.map((s) => [s.id, s.name]));
  const rollsByLot = new Map<string, Roll[]>();
  for (const r of ds.rolls) {
    const l = rollsByLot.get(r.lotId);
    if (l) l.push(r);
    else rollsByLot.set(r.lotId, [r]);
  }
  const out: PurchaseRow[] = [];
  for (let i = ds.purchaseInvoices.length - 1; i >= 0; i--) {
    const p = ds.purchaseInvoices[i]!;
    if (p.date < current.from || (f !== "all" && p.warehouseId !== f)) continue;
    const lots = p.lotIds.map((id) => ix.lotById.get(id)).filter((l): l is DyeLot => Boolean(l));
    let meters = 0;
    let kilos = 0;
    let rolls = 0;
    for (const lot of lots) {
      const unit = ix.itemById.get(lot.itemId)?.unit;
      for (const r of rollsByLot.get(lot.id) ?? []) {
        rolls++;
        if (unit === "kg") kilos += r.quantity;
        else meters += r.quantity;
      }
    }
    out.push({
      invoice: p,
      supplierName: supplierName.get(p.supplierId) ?? "",
      lots,
      rolls,
      meters,
      kilos,
      colors: lots.map((l) => ix.colorById.get(l.colorId)?.hex ?? "#999"),
      itemNames: [...new Set(lots.map((l) => ix.itemById.get(l.itemId)?.name ?? ""))].join(" + "),
    });
  }
  return out;
}

/* ───────────── استلام بضاعة جديدة ───────────── */

export class PurchaseError extends Error {}

export interface LotInput {
  itemId: string;
  colorId: string;
  /** سعر المورد للمتر أو الكيلو (قبل مصاريف النقل) */
  unitCost: number;
  /** أطوال أو أوزان التواب الفعلية */
  rolls: number[];
}

export interface PurchaseDraft {
  warehouseId: WarehouseId;
  supplierId: string;
  supplierRef: string;
  lots: LotInput[];
  /** مصاريف نقل وتحميل — بتتدفع نقدي من الخزنة وتتوزع على الطبخات حسب قيمتها */
  extraCost: number;
  paidNow: number;
  createdBy: string;
}

export interface LandedLot {
  qty: number;
  value: number;
  extraShare: number;
  landedUnitCost: number;
}

/** توزيع المصاريف الإضافية على الطبخات بنسبة قيمة كل طبخة */
export function landedCosts(lots: LotInput[], extraCost: number): LandedLot[] {
  const base = lots.map((l) => {
    const qty = l.rolls.reduce((s, q) => s + q, 0);
    return { qty, value: qty * (l.unitCost || 0) };
  });
  const totalValue = base.reduce((s, b) => s + b.value, 0);
  return base.map((b) => {
    const share = totalValue > 0 ? (b.value / totalValue) * Math.max(0, extraCost) : 0;
    return { ...b, extraShare: share, landedUnitCost: b.qty > 0 ? (b.value + share) / b.qty : 0 };
  });
}

export function nextLotCode(ds: DemoDataset): number {
  return ds.lots.reduce((m, l) => Math.max(m, Number(l.code) || 0), 0) + 1;
}

export function nextPurchaseNumber(ds: DemoDataset): number {
  return ds.purchaseInvoices.reduce((m, p) => Math.max(m, Number(p.number.replace(/\D/g, "")) || 0), 0) + 1;
}

/** بيحوّل نص فيه أرقام (مسافات، سطور، فواصل، أرقام عربي) لقائمة أطوال */
export function parseLengths(text: string): number[] {
  const western = text.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/٫/g, ".");
  return western
    .split(/[\s,،;+]+/)
    .map((t) => Number(t))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function commitPurchase(ds: DemoDataset, ix: Indexes, d: PurchaseDraft): { ds: DemoDataset; invoice: PurchaseInvoice; lots: DyeLot[]; rolls: Roll[] } {
  const supplier = ds.suppliers.find((s) => s.id === d.supplierId);
  if (!supplier) throw new PurchaseError("اختار المورد.");
  if (d.lots.length === 0) throw new PurchaseError("ضيف طبخة واحدة على الأقل.");
  d.lots.forEach((l, i) => {
    const item = ix.itemById.get(l.itemId);
    if (!item) throw new PurchaseError(`الطبخة ${i + 1}: اختار الصنف.`);
    if (!item.colorIds.includes(l.colorId)) throw new PurchaseError(`الطبخة ${i + 1}: اختار اللون.`);
    if (!(l.unitCost > 0)) throw new PurchaseError(`الطبخة ${i + 1}: اكتب سعر ${item.unit === "kg" ? "الكيلو" : "المتر"}.`);
    if (l.rolls.length === 0) throw new PurchaseError(`الطبخة ${i + 1}: اكتب أطوال التواب.`);
    const [min, max] = item.unit === "kg" ? [20, 250] : [10, 150];
    const bad = l.rolls.find((q) => q < min || q > max);
    if (bad !== undefined) throw new PurchaseError(`الطبخة ${i + 1}: ${bad} ${item.unit === "kg" ? "كيلو" : "متر"} رقم مش منطقي للتوب.`);
  });

  const landed = landedCosts(d.lots, d.extraCost);
  const total = r2(landed.reduce((s, l) => s + l.value, 0));
  const extra = r2(Math.max(0, d.extraCost || 0));
  const paidNow = r2(Math.max(0, d.paidNow || 0));
  if (paidNow > total + 0.5) throw new PurchaseError("المدفوع أكبر من قيمة الفاتورة.");
  const box = cashBoxBalance(ds, d.warehouseId);
  if (paidNow + extra > box) {
    throw new PurchaseError(`خزنة ${WH[d.warehouseId]} فيها ${Math.round(box).toLocaleString("en-US")} ج.م بس — مش هتكفي الدفعة والمصاريف.`);
  }

  let code = nextLotCode(ds);
  let rollSeq = ds.rolls.length;
  const n = nextPurchaseNumber(ds);
  const newLots: DyeLot[] = [];
  const newRolls: Roll[] = [];
  d.lots.forEach((l, i) => {
    const lotCode = String(code++);
    const lot: DyeLot = {
      id: `lot-${lotCode}`,
      code: lotCode,
      itemId: l.itemId,
      colorId: l.colorId,
      supplierId: supplier.id,
      warehouseId: d.warehouseId,
      receivedOn: ds.today,
      unitCost: r2(landed[i]!.landedUnitCost),
      rollCount: l.rolls.length,
    };
    newLots.push(lot);
    l.rolls.forEach((q, k) => {
      newRolls.push({
        id: `roll-${++rollSeq}`,
        code: `${lotCode}-${String(k + 1).padStart(2, "0")}`,
        lotId: lot.id,
        itemId: l.itemId,
        colorId: l.colorId,
        warehouseId: d.warehouseId,
        quantity: r2(q),
        status: "available",
        receivedOn: ds.today,
      });
    });
  });

  const invoice: PurchaseInvoice = {
    id: `po-${n}`,
    number: `PO-${n}`,
    date: ds.today,
    warehouseId: d.warehouseId,
    supplierId: supplier.id,
    lotIds: newLots.map((l) => l.id),
    total,
    paidNow,
    supplierRef: d.supplierRef.trim() || undefined,
    extraCost: extra || undefined,
    createdBy: d.createdBy,
  };

  const cash: CashTransaction[] = [];
  if (paidNow > 0) {
    cash.push({
      id: `cash-u-po-${n}`,
      date: ds.today,
      warehouseId: d.warehouseId,
      kind: "supplier_payment",
      amount: -paidNow,
      note: `دفعة مع فاتورة ${invoice.number} — ${supplier.name}`,
      partyId: supplier.id,
    });
  }
  if (extra > 0) {
    cash.push({
      id: `cash-u-poex-${n}`,
      date: ds.today,
      warehouseId: d.warehouseId,
      kind: "expense",
      amount: -extra,
      note: `نقل وتحميل — فاتورة ${invoice.number}`,
    });
  }

  return {
    ds: {
      ...ds,
      lots: [...ds.lots, ...newLots],
      rolls: [...ds.rolls, ...newRolls],
      purchaseInvoices: [...ds.purchaseInvoices, invoice],
      cash: [...ds.cash, ...cash],
    },
    invoice,
    lots: newLots,
    rolls: newRolls,
  };
}

/* ───────────── سداد مورد ───────────── */

export interface SupplierPaymentDraft {
  supplierId: string;
  warehouseId: WarehouseId;
  amount: number;
  note: string;
  createdBy: string;
}

export function commitSupplierPayment(ds: DemoDataset, d: SupplierPaymentDraft): DemoDataset {
  const supplier = ds.suppliers.find((s) => s.id === d.supplierId);
  if (!supplier) throw new PurchaseError("اختار المورد.");
  const amount = r2(d.amount);
  if (!(amount > 0)) throw new PurchaseError("اكتب المبلغ.");
  const bal = supplierRows(ds).find((r) => r.supplier.id === supplier.id)?.balance ?? 0;
  if (amount > bal + 0.5) throw new PurchaseError(`المبلغ أكبر من المستحق للمورد (${Math.round(bal).toLocaleString("en-US")} ج.م).`);
  const box = cashBoxBalance(ds, d.warehouseId);
  if (amount > box) throw new PurchaseError(`خزنة ${WH[d.warehouseId]} فيها ${Math.round(box).toLocaleString("en-US")} ج.م بس.`);
  const note = d.note.trim();
  return {
    ...ds,
    cash: [
      ...ds.cash,
      {
        id: `cash-u-sp-${ds.cash.length + 1}`,
        date: ds.today,
        warehouseId: d.warehouseId,
        kind: "supplier_payment",
        amount: -amount,
        note: `سداد للمورد — ${supplier.name}${note ? ` (${note})` : ""}`,
        partyId: supplier.id,
      },
    ],
  };
}

/* ───────────── كشف حساب المورد ───────────── */

export interface SupplierLedgerEntry {
  id: string;
  date: IsoDate;
  kind: "purchase" | "payment";
  description: string;
  /** له (فاتورة شراء) */
  credit: number;
  /** اتدفع له */
  debit: number;
  balance: number;
  purchaseId?: string;
  warehouseId: WarehouseId;
}

export function supplierLedger(ds: DemoDataset, ix: Indexes, supplierId: string): SupplierLedgerEntry[] {
  const raw: Omit<SupplierLedgerEntry, "balance">[] = [];
  for (const p of ds.purchaseInvoices) {
    if (p.supplierId !== supplierId) continue;
    const names = [...new Set(p.lotIds.map((id) => ix.itemById.get(ix.lotById.get(id)?.itemId ?? "")?.name ?? ""))].join(" + ");
    raw.push({
      id: p.id,
      date: p.date,
      kind: "purchase",
      description: `فاتورة ${p.number} — ${names} · ${p.lotIds.length} طبخة${p.supplierRef ? ` · ${p.supplierRef}` : ""}`,
      credit: p.total,
      debit: 0,
      purchaseId: p.id,
      warehouseId: p.warehouseId,
    });
  }
  for (const t of ds.cash) {
    if (t.kind !== "supplier_payment" || t.partyId !== supplierId) continue;
    raw.push({
      id: t.id,
      date: t.date,
      kind: "payment",
      description: t.note.startsWith("دفعة مع") ? t.note.split(" — ")[0]! : "سداد نقدي",
      credit: 0,
      debit: -t.amount,
      warehouseId: t.warehouseId,
    });
  }
  raw.sort((a, b) => (a.date === b.date ? (a.kind === "purchase" ? -1 : 1) : a.date < b.date ? -1 : 1));
  let bal = 0;
  return raw.map((e) => {
    bal += e.credit - e.debit;
    return { ...e, balance: r2(bal) };
  });
}
