// src/data/reports.ts
// التقارير: الأرباح والخسائر المبسّطة، الربح بالصنف والعميل، حركة الأصناف واقتراح الشراء، الراكد، وحركة الخزن.
// كله محسوب من نفس البيانات اللي بتتعرض في باقي الشاشات — مفيش أرقام متخزّنة لوحدها.
// في DRF: /api/reports/pnl ، /api/reports/items ، /api/reports/velocity ، /api/reports/stagnant ، /api/reports/cashflow
import { addDays, diffDays, isFriday, type IsoDate } from "@/lib/dates";
import { inventoryByItem } from "./inventory";
import type { Indexes, Period, WarehouseFilter } from "./selectors";
import { hitsCashBox, periodRange } from "./selectors";
import type { CashKind, DemoDataset, Item, WarehouseId } from "./types";

const inScope = (w: WarehouseId, f: WarehouseFilter) => f === "all" || f === w;

function workingDays(from: IsoDate, to: IsoDate): number {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (!isFriday(d)) n++;
  return Math.max(1, n);
}

/* ───────────── الأرباح والخسائر المبسّطة ───────────── */

export interface PnL {
  sales: number;
  discounts: number;
  cogs: number;
  gross: number;
  grossMargin: number;
  labor: number;
  opex: number;
  net: number;
  netMargin: number;
  invoices: number;
  previousNet: number | null;
}

function pnlFor(ds: DemoDataset, f: WarehouseFilter, from: IsoDate, to: IsoDate): Omit<PnL, "previousNet"> {
  let sales = 0;
  let discounts = 0;
  let cogs = 0;
  let invoices = 0;
  for (const inv of ds.salesInvoices) {
    if (inv.date < from || inv.date > to || !inScope(inv.warehouseId, f)) continue;
    sales += inv.total;
    discounts += inv.discount ?? 0;
    cogs += inv.cost;
    invoices++;
  }
  let labor = 0;
  for (const p of ds.payroll) {
    if (p.date < from || p.date > to || !inScope(p.warehouseId, f)) continue;
    labor += p.gross + (p.bonus ?? 0) - (p.penalty ?? 0);
  }
  let opex = 0;
  for (const t of ds.cash) {
    if (t.kind !== "expense" || t.date < from || t.date > to || !inScope(t.warehouseId, f)) continue;
    // مصاريف النقل بتاعة المشتريات داخلة في تكلفة البضاعة (Landed Cost) — مش مصروف تشغيل
    if (t.note.startsWith("نقل وتحميل — فاتورة PO")) continue;
    opex += -t.amount;
  }
  const gross = sales - cogs;
  const net = gross - labor - opex;
  return {
    sales,
    discounts,
    cogs,
    gross,
    grossMargin: sales > 0 ? (gross / sales) * 100 : 0,
    labor,
    opex,
    net,
    netMargin: sales > 0 ? (net / sales) * 100 : 0,
    invoices,
  };
}

export function profitAndLoss(ds: DemoDataset, f: WarehouseFilter, period: Period): PnL {
  const { current, previous } = periodRange(ds.today, period);
  const cur = pnlFor(ds, f, current.from, current.to);
  const prevStart = ds.salesInvoices[0]?.date ?? ds.today;
  const prev = previous.from >= prevStart ? pnlFor(ds, f, previous.from, previous.to) : null;
  return { ...cur, previousNet: prev ? prev.net : null };
}

/* ───────────── الربح بالصنف وبالعميل ───────────── */

export interface ProfitRow {
  id: string;
  name: string;
  sub?: string;
  sales: number;
  cost: number;
  profit: number;
  margin: number;
  rolls: number;
  qty: number;
  unit?: Item["unit"];
  invoices: number;
}

export function profitByItem(ds: DemoDataset, ix: Indexes, f: WarehouseFilter, period: Period): ProfitRow[] {
  const { current } = periodRange(ds.today, period);
  const map = new Map<string, ProfitRow>();
  for (const inv of ds.salesInvoices) {
    if (inv.date < current.from || !inScope(inv.warehouseId, f)) continue;
    const gross = inv.lines.reduce((s, l) => s + l.total, 0);
    const factor = gross > 0 ? inv.total / gross : 1; // توزيع الخصم على البنود
    const seen = new Set<string>();
    for (const l of inv.lines) {
      const item = ix.itemById.get(l.itemId);
      if (!item) continue;
      const row =
        map.get(item.id) ??
        { id: item.id, name: item.name, sub: item.season === "winter" ? "شتوي" : "صيفي", sales: 0, cost: 0, profit: 0, margin: 0, rolls: 0, qty: 0, unit: item.unit, invoices: 0 };
      row.sales += l.total * factor;
      row.cost += l.cost;
      row.rolls += l.rollIds.length;
      row.qty += l.quantity;
      if (!seen.has(item.id)) {
        row.invoices++;
        seen.add(item.id);
      }
      map.set(item.id, row);
    }
  }
  return finish([...map.values()]);
}

export function profitByCustomer(ds: DemoDataset, ix: Indexes, f: WarehouseFilter, period: Period): ProfitRow[] {
  const { current } = periodRange(ds.today, period);
  const map = new Map<string, ProfitRow>();
  for (const inv of ds.salesInvoices) {
    if (inv.date < current.from || !inScope(inv.warehouseId, f)) continue;
    const c = ix.customerById.get(inv.customerId);
    if (!c) continue;
    const row = map.get(c.id) ?? { id: c.id, name: c.name, sub: c.area, sales: 0, cost: 0, profit: 0, margin: 0, rolls: 0, qty: 0, invoices: 0 };
    row.sales += inv.total;
    row.cost += inv.cost;
    row.rolls += inv.rollCount;
    row.invoices++;
    map.set(c.id, row);
  }
  return finish([...map.values()]);
}

function finish(rows: ProfitRow[]): ProfitRow[] {
  for (const r of rows) {
    r.profit = r.sales - r.cost;
    r.margin = r.sales > 0 ? (r.profit / r.sales) * 100 : 0;
  }
  return rows.sort((a, b) => b.profit - a.profit);
}

/* ───────────── حركة الأصناف واقتراح الشراء ───────────── */

export type VelocityStatus = "reorder" | "ok" | "excess" | "idle";

export const VELOCITY_META: Record<VelocityStatus, { label: string; cls: string }> = {
  reorder: { label: "اطلب تاني", cls: "chip--crit" },
  ok: { label: "كويس", cls: "chip--good" },
  excess: { label: "زيادة", cls: "chip--warn" },
  idle: { label: "واقف", cls: "chip--flat" },
};

export interface VelocityRow {
  itemId: string;
  itemName: string;
  colorId: string;
  colorName: string;
  colorHex: string;
  unit: Item["unit"];
  season: Item["season"];
  soldRolls: number;
  perWeek: number;
  stockRolls: number;
  inTransit: number;
  coverDays: number | null;
  status: VelocityStatus;
  /** عدد التواب المقترح طلبها عشان تغطي 45 يوم شغل */
  suggest: number;
}

const COVER_TARGET = 45;
const REORDER_BELOW = 21;

export function itemVelocity(ds: DemoDataset, ix: Indexes, f: WarehouseFilter, period: Period): VelocityRow[] {
  const { current } = periodRange(ds.today, period);
  // نحتاج نافذة كفاية عشان المعدل يبقى منطقي — أقل حاجة 30 يوم
  const from = period === "today" || period === "7d" ? addDays(ds.today, -29) : current.from;
  const days = workingDays(from, ds.today);
  const sold = new Map<string, number>();
  for (const inv of ds.salesInvoices) {
    if (inv.date < from || !inScope(inv.warehouseId, f)) continue;
    for (const l of inv.lines) sold.set(`${l.itemId}|${l.colorId}`, (sold.get(`${l.itemId}|${l.colorId}`) ?? 0) + l.rollIds.length);
  }
  const stock = new Map<string, number>();
  const transit = new Map<string, number>();
  for (const r of ds.rolls) {
    if (!inScope(r.warehouseId, f)) continue;
    const k = `${r.itemId}|${r.colorId}`;
    if (r.status === "available") stock.set(k, (stock.get(k) ?? 0) + 1);
    else if (r.status === "in_transit") transit.set(k, (transit.get(k) ?? 0) + 1);
  }
  const out: VelocityRow[] = [];
  for (const item of ds.items) {
    for (const cid of item.colorIds) {
      const k = `${item.id}|${cid}`;
      const s = sold.get(k) ?? 0;
      const st = stock.get(k) ?? 0;
      const tr = transit.get(k) ?? 0;
      const perDay = s / days;
      const cover = perDay > 0 ? (st + tr) / perDay : null;
      let status: VelocityStatus;
      if (s === 0) status = "idle";
      else if ((cover ?? 0) < REORDER_BELOW) status = "reorder";
      else if ((cover ?? 0) > 90) status = "excess";
      else status = "ok";
      const color = ix.colorById.get(cid);
      out.push({
        itemId: item.id,
        itemName: item.name,
        colorId: cid,
        colorName: color?.name ?? "",
        colorHex: color?.hex ?? "#999",
        unit: item.unit,
        season: item.season,
        soldRolls: s,
        perWeek: perDay * 6,
        stockRolls: st,
        inTransit: tr,
        coverDays: cover,
        status,
        suggest: status === "reorder" ? Math.max(1, Math.ceil(perDay * COVER_TARGET - st - tr)) : 0,
      });
    }
  }
  const order: Record<VelocityStatus, number> = { reorder: 0, ok: 1, excess: 2, idle: 3 };
  return out.sort((a, b) => order[a.status] - order[b.status] || (a.coverDays ?? 9999) - (b.coverDays ?? 9999) || b.soldRolls - a.soldRolls);
}

/* ───────────── المخزون الراكد ───────────── */

export interface StagnantRow {
  lotId: string;
  lotCode: string;
  itemName: string;
  season: Item["season"];
  colorName: string;
  colorHex: string;
  rolls: number;
  qty: number;
  unit: Item["unit"];
  value: number;
  idleDays: number;
  byWarehouse: Record<WarehouseId, number>;
}

export function stagnantStock(ds: DemoDataset, ix: Indexes, f: WarehouseFilter, minIdle = 45): StagnantRow[] {
  const rows: StagnantRow[] = [];
  for (const r of inventoryByItem(ds, ix, f)) {
    for (const l of r.lots) {
      if (l.available === 0) continue;
      const idle = diffDays(ds.today, l.lastSale ?? l.lot.receivedOn);
      if (idle < minIdle) continue;
      rows.push({
        lotId: l.lot.id,
        lotCode: l.lot.code,
        itemName: r.item.name,
        season: r.item.season,
        colorName: l.colorName,
        colorHex: l.colorHex,
        rolls: l.available,
        qty: l.availableQty,
        unit: r.item.unit,
        value: l.availableQty * l.lot.unitCost,
        idleDays: idle,
        byWarehouse: l.byWarehouse,
      });
    }
  }
  return rows.sort((a, b) => b.value - a.value);
}

/* ───────────── حركة الخزن ───────────── */

export const CASH_KIND_LABEL: Record<CashKind, string> = {
  cash_sale: "بيع نقدي",
  collection: "تحصيلات نقدي",
  cash_transfer_in: "تحويل وارد من الخزنة التانية",
  supplier_payment: "سداد موردين",
  salary: "مرتبات وأسبوعيات",
  advance: "سلف عمال",
  expense: "مصروفات",
  cash_transfer_out: "تحويل صادر للخزنة التانية",
  bank_deposit: "إيداع في البنك",
  adjustment: "تسوية جرد الخزنة",
};

const IN_KINDS: CashKind[] = ["cash_sale", "collection", "cash_transfer_in"];
const OUT_KINDS: CashKind[] = ["supplier_payment", "salary", "advance", "expense", "cash_transfer_out", "bank_deposit"];

export interface CashFlowRow {
  kind: CashKind;
  direction: "in" | "out";
  kerdasa: number;
  mahalla: number;
  total: number;
}

export interface CashFlow {
  rows: CashFlowRow[];
  inflow: Record<WarehouseId | "total", number>;
  outflow: Record<WarehouseId | "total", number>;
  /** تحصيلات بنكي وإنستاباي — مابتدخلش الخزنة */
  nonCash: number;
}

export function cashFlow(ds: DemoDataset, f: WarehouseFilter, period: Period): CashFlow {
  const { current } = periodRange(ds.today, period);
  const rows = new Map<CashKind, CashFlowRow>();
  for (const k of [...IN_KINDS, ...OUT_KINDS]) {
    rows.set(k, { kind: k, direction: IN_KINDS.includes(k) ? "in" : "out", kerdasa: 0, mahalla: 0, total: 0 });
  }
  let nonCash = 0;
  for (const t of ds.cash) {
    if (t.date < current.from || !inScope(t.warehouseId, f)) continue;
    if (!hitsCashBox(t)) {
      nonCash += t.amount;
      continue;
    }
    const row = rows.get(t.kind);
    if (!row) continue;
    const v = Math.abs(t.amount);
    row[t.warehouseId] += v;
    row.total += v;
  }
  const all = [...rows.values()].filter((r) => r.total > 0);
  const sum = (dir: "in" | "out", key: WarehouseId | "total") => all.filter((r) => r.direction === dir).reduce((s, r) => s + r[key], 0);
  return {
    rows: all,
    inflow: { kerdasa: sum("in", "kerdasa"), mahalla: sum("in", "mahalla"), total: sum("in", "total") },
    outflow: { kerdasa: sum("out", "kerdasa"), mahalla: sum("out", "mahalla"), total: sum("out", "total") },
    nonCash,
  };
}
