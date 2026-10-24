// src/data/selectors.ts
// حسابات لوحة التحكم (Dashboard Selectors) — دوال نقية (Pure Functions) بتاخد البيانات والفلاتر
// وترجع الأرقام الجاهزة للعرض. نفس الحسابات دي هتتنقل بعدين لـ Django كـ API endpoints.
import { addDays, diffDays, isFriday, monthOf, type IsoDate } from "@/lib/dates";
import type { CashTransaction, DemoDataset, DyeLot, Item, Roll, SalesInvoice, StockTransfer, WarehouseId } from "./types";

export type WarehouseFilter = "all" | WarehouseId;
export type Period = "today" | "7d" | "30d" | "90d";

export const PERIOD_DAYS: Record<Period, number> = { today: 1, "7d": 7, "30d": 30, "90d": 90 };

export const PERIOD_LABEL: Record<Period, string> = {
  today: "النهارده",
  "7d": "آخر 7 أيام",
  "30d": "آخر 30 يوم",
  "90d": "آخر 90 يوم",
};

export interface Range {
  from: IsoDate;
  to: IsoDate;
}

export function periodRange(today: IsoDate, period: Period): { current: Range; previous: Range } {
  const n = PERIOD_DAYS[period];
  const from = addDays(today, -(n - 1));
  return {
    current: { from, to: today },
    previous: { from: addDays(from, -n), to: addDays(from, -1) },
  };
}

const inRange = (d: IsoDate, r: Range) => d >= r.from && d <= r.to;
const matchWh = (wh: WarehouseId, f: WarehouseFilter) => f === "all" || f === wh;

export interface Indexes {
  itemById: Map<string, Item>;
  lotById: Map<string, DyeLot>;
  rollById: Map<string, Roll>;
  colorById: Map<string, { name: string; hex: string }>;
  customerById: Map<string, DemoDataset["customers"][number]>;
}

export function buildIndexes(ds: DemoDataset): Indexes {
  return {
    itemById: new Map(ds.items.map((i) => [i.id, i])),
    lotById: new Map(ds.lots.map((l) => [l.id, l])),
    rollById: new Map(ds.rolls.map((r) => [r.id, r])),
    colorById: new Map(ds.colors.map((c) => [c.id, c])),
    customerById: new Map(ds.customers.map((c) => [c.id, c])),
  };
}

/* ───────────── مؤشرات الأداء (KPIs) ───────────── */

export interface Kpi {
  value: number;
  previous: number;
  /** نسبة التغيير، null لو مفيش فترة سابقة للمقارنة */
  delta: number | null;
  spark: number[];
}

function sumSales(ds: DemoDataset, r: Range, f: WarehouseFilter, pick: (inv: SalesInvoice) => number) {
  let s = 0;
  for (const inv of ds.salesInvoices) if (inRange(inv.date, r) && matchWh(inv.warehouseId, f)) s += pick(inv);
  return s;
}

function sumCash(ds: DemoDataset, r: Range, f: WarehouseFilter, pred: (t: CashTransaction) => boolean) {
  let s = 0;
  for (const t of ds.cash) if (inRange(t.date, r) && matchWh(t.warehouseId, f) && pred(t)) s += t.amount;
  return s;
}

/** أيام الشغل في الفترة (الجمعة إجازة فبتتشال من الرسوم عشان الخط مايقعش للصفر كل أسبوع) */
function sparkDays(today: IsoDate, period: Period): IsoDate[] {
  const n = period === "today" ? 14 : PERIOD_DAYS[period];
  return Array.from({ length: n }, (_, i) => addDays(today, -(n - 1 - i))).filter((d) => !isFriday(d));
}

const pctDelta = (cur: number, prev: number) => (prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100);

export interface DashboardKpis {
  sales: Kpi;
  grossProfit: Kpi & { margin: number };
  collections: Kpi;
  receivables: { value: number; customers: number; overLimit: number };
  stock: { rolls: number; meters: number; kilos: number; value: number; inTransit: number };
  cashTotal: number;
  invoiceCount: number;
  rollsSold: number;
}

const isCollection = (t: CashTransaction) => t.kind === "cash_sale" || t.kind === "collection";

export function computeKpis(ds: DemoDataset, ix: Indexes, f: WarehouseFilter, period: Period): DashboardKpis {
  const { current, previous } = periodRange(ds.today, period);
  const days = sparkDays(ds.today, period);
  const dayRange = (d: IsoDate): Range => ({ from: d, to: d });

  const salesCur = sumSales(ds, current, f, (i) => i.total);
  const salesPrev = sumSales(ds, previous, f, (i) => i.total);
  const profitCur = sumSales(ds, current, f, (i) => i.total - i.cost);
  const profitPrev = sumSales(ds, previous, f, (i) => i.total - i.cost);
  const colCur = sumCash(ds, current, f, isCollection);
  const colPrev = sumCash(ds, previous, f, isCollection);

  const balances = customerBalances(ds);
  let receivables = 0;
  let debtors = 0;
  let overLimit = 0;
  for (const c of ds.customers) {
    if (!matchWh(c.homeWarehouseId, f)) continue;
    const b = balances.get(c.id)?.balance ?? 0;
    if (b > 0) {
      receivables += b;
      debtors++;
      if (b > c.creditLimit) overLimit++;
    }
  }

  let rolls = 0;
  let meters = 0;
  let kilos = 0;
  let value = 0;
  let inTransit = 0;
  for (const r of ds.rolls) {
    if (!matchWh(r.warehouseId, f)) continue;
    if (r.status === "in_transit") {
      inTransit++;
      continue;
    }
    if (r.status !== "available") continue;
    rolls++;
    const item = ix.itemById.get(r.itemId);
    if (item?.unit === "meter") meters += r.quantity;
    else kilos += r.quantity;
    value += r.quantity * (ix.lotById.get(r.lotId)?.unitCost ?? 0);
  }

  let invoiceCount = 0;
  let rollsSold = 0;
  for (const inv of ds.salesInvoices) {
    if (inRange(inv.date, current) && matchWh(inv.warehouseId, f)) {
      invoiceCount++;
      rollsSold += inv.rollCount;
    }
  }

  return {
    sales: {
      value: salesCur,
      previous: salesPrev,
      delta: pctDelta(salesCur, salesPrev),
      spark: days.map((d) => sumSales(ds, dayRange(d), f, (i) => i.total)),
    },
    grossProfit: {
      value: profitCur,
      previous: profitPrev,
      delta: pctDelta(profitCur, profitPrev),
      spark: days.map((d) => sumSales(ds, dayRange(d), f, (i) => i.total - i.cost)),
      margin: salesCur > 0 ? (profitCur / salesCur) * 100 : 0,
    },
    collections: {
      value: colCur,
      previous: colPrev,
      delta: pctDelta(colCur, colPrev),
      spark: days.map((d) => sumCash(ds, dayRange(d), f, isCollection)),
    },
    receivables: { value: receivables, customers: debtors, overLimit },
    stock: { rolls, meters, kilos, value, inTransit },
    cashTotal: (["kerdasa", "mahalla"] as const)
      .filter((w) => matchWh(w, f))
      .reduce((s, w) => s + cashBoxBalance(ds, w), 0),
    invoiceCount,
    rollsSold,
  };
}

/* ───────────── الخزن (Cash Boxes) ───────────── */

/** الحركة دي بتأثر على الخزنة؟ (التحويل البنكي وإنستاباي لأ) */
export const hitsCashBox = (t: CashTransaction) => !t.method || t.method === "cash";

export function cashBoxBalance(ds: DemoDataset, wh: WarehouseId): number {
  return ds.openingCash[wh] + ds.cash.reduce((s, t) => (t.warehouseId === wh && hitsCashBox(t) ? s + t.amount : s), 0);
}

export interface CashBoxSummary {
  warehouseId: WarehouseId;
  balance: number;
  inflow: number;
  outflow: number;
  recent: CashTransaction[];
}

export function cashBoxes(ds: DemoDataset, f: WarehouseFilter, period: Period): CashBoxSummary[] {
  const { current } = periodRange(ds.today, period);
  return (["kerdasa", "mahalla"] as const)
    .filter((w) => matchWh(w, f))
    .map((wh) => {
      const tx = ds.cash.filter((t) => t.warehouseId === wh && hitsCashBox(t));
      const inPeriod = tx.filter((t) => inRange(t.date, current));
      return {
        warehouseId: wh,
        balance: cashBoxBalance(ds, wh),
        inflow: inPeriod.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
        outflow: inPeriod.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0),
        recent: tx.slice(-4).reverse(),
      };
    });
}

/* ───────────── المبيعات عبر الزمن (Sales Trend) ───────────── */

export interface TrendPoint {
  key: string;
  from: IsoDate;
  to: IsoDate;
  kerdasa: number;
  mahalla: number;
}

export function salesTrend(ds: DemoDataset, period: Period): TrendPoint[] {
  const bucketDays = period === "90d" ? 7 : 1;
  const totalDays = period === "today" ? 14 : PERIOD_DAYS[period];
  const buckets = Math.ceil(totalDays / bucketDays);
  const points: TrendPoint[] = [];
  for (let b = buckets - 1; b >= 0; b--) {
    const to = addDays(ds.today, -b * bucketDays);
    const from = addDays(to, -(bucketDays - 1));
    if (bucketDays === 1 && isFriday(to)) continue;
    points.push({ key: to, from, to, kerdasa: 0, mahalla: 0 });
  }
  const first = points[0]?.from ?? ds.today;
  for (const inv of ds.salesInvoices) {
    if (inv.date < first || inv.date > ds.today) continue;
    const p = points.find((pt) => inv.date >= pt.from && inv.date <= pt.to);
    if (p) p[inv.warehouseId] += inv.total;
  }
  return points;
}

/* ───────────── توزيع المخزون ───────────── */

export interface StockSplit {
  warehouseId: WarehouseId;
  rolls: number;
  value: number;
  summerValue: number;
  winterValue: number;
}

export function stockSplit(ds: DemoDataset, ix: Indexes): StockSplit[] {
  return (["kerdasa", "mahalla"] as const).map((wh) => {
    let rolls = 0;
    let value = 0;
    let summerValue = 0;
    let winterValue = 0;
    for (const r of ds.rolls) {
      if (r.warehouseId !== wh || r.status !== "available") continue;
      const v = r.quantity * (ix.lotById.get(r.lotId)?.unitCost ?? 0);
      rolls++;
      value += v;
      if (ix.itemById.get(r.itemId)?.season === "summer") summerValue += v;
      else winterValue += v;
    }
    return { warehouseId: wh, rolls, value, summerValue, winterValue };
  });
}

/* ───────────── أعلى الأصناف مبيعاً ───────────── */

export interface ItemSales {
  itemId: string;
  name: string;
  unit: Item["unit"];
  kerdasa: number;
  mahalla: number;
  total: number;
  rolls: number;
  quantity: number;
}

export function topItems(ds: DemoDataset, ix: Indexes, f: WarehouseFilter, period: Period, limit = 6): ItemSales[] {
  const { current } = periodRange(ds.today, period);
  const map = new Map<string, ItemSales>();
  for (const inv of ds.salesInvoices) {
    if (!inRange(inv.date, current) || !matchWh(inv.warehouseId, f)) continue;
    for (const line of inv.lines) {
      const item = ix.itemById.get(line.itemId);
      if (!item) continue;
      const row =
        map.get(item.id) ??
        { itemId: item.id, name: item.name, unit: item.unit, kerdasa: 0, mahalla: 0, total: 0, rolls: 0, quantity: 0 };
      row[inv.warehouseId] += line.total;
      row.total += line.total;
      row.rolls += line.rollIds.length;
      row.quantity += line.quantity;
      map.set(item.id, row);
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

/* ───────────── جاهزية التشكيلات ─────────────
   العميل بياخد الصنف بكل ألوانه، فلو لون واحد ناقص ممكن البيعة كلها تضيع. */

export interface AssortmentCell {
  colorId: string;
  name: string;
  hex: string;
  rolls: number;
}

export interface AssortmentRow {
  itemId: string;
  name: string;
  season: Item["season"];
  inSeason: boolean;
  cells: AssortmentCell[];
  complete: number;
  total: number;
}

export function assortmentReadiness(ds: DemoDataset, ix: Indexes, wh: WarehouseId): AssortmentRow[] {
  const counts = new Map<string, number>();
  for (const r of ds.rolls) {
    if (r.warehouseId !== wh || r.status !== "available") continue;
    const k = `${r.itemId}|${r.colorId}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const month = monthOf(ds.today);
  const winterActive = month >= 9 || month <= 2;
  return ds.items
    .map((item) => {
      const cells = item.colorIds.map((cid) => {
        const c = ix.colorById.get(cid);
        return { colorId: cid, name: c?.name ?? cid, hex: c?.hex ?? "#999", rolls: counts.get(`${item.id}|${cid}`) ?? 0 };
      });
      return {
        itemId: item.id,
        name: item.name,
        season: item.season,
        inSeason: item.season === (winterActive ? "winter" : "summer"),
        cells,
        complete: cells.filter((c) => c.rolls > 0).length,
        total: cells.length,
      };
    })
    .sort((a, b) => Number(b.inSeason) - Number(a.inSeason));
}

/* ───────────── أرصدة العملاء ───────────── */

export interface CustomerBalance {
  balance: number;
  lastPayment: IsoDate | null;
  firstInvoice: IsoDate | null;
  lastInvoice: IsoDate | null;
}

export function customerBalances(ds: DemoDataset): Map<string, CustomerBalance> {
  const map = new Map<string, CustomerBalance>(
    ds.customers.map((c) => [c.id, { balance: 0, lastPayment: null, firstInvoice: null, lastInvoice: null }]),
  );
  for (const inv of ds.salesInvoices) {
    const m = map.get(inv.customerId)!;
    m.balance += inv.total - inv.paidNow;
    m.lastInvoice = inv.date;
    if (!m.firstInvoice) m.firstInvoice = inv.date;
  }
  for (const t of ds.cash) {
    if (!t.partyId || !(t.kind === "collection" || t.kind === "cash_sale")) continue;
    const m = map.get(t.partyId);
    if (!m) continue;
    if (t.kind === "collection") m.balance -= t.amount;
    if (!m.lastPayment || t.date > m.lastPayment) m.lastPayment = t.date;
  }
  return map;
}

/** أيام من آخر دفعة، ولو العميل مدفعش خالص: من أول فاتورة */
export function daysSincePaid(today: IsoDate, b: CustomerBalance): number | null {
  const ref = b.lastPayment ?? b.firstInvoice;
  return ref ? diffDays(today, ref) : null;
}

export interface Debtor {
  customerId: string;
  name: string;
  area: string;
  warehouseId: WarehouseId;
  balance: number;
  creditLimit: number;
  daysSincePayment: number | null;
}

export function topDebtors(ds: DemoDataset, f: WarehouseFilter, limit = 6): Debtor[] {
  const balances = customerBalances(ds);
  return ds.customers
    .filter((c) => matchWh(c.homeWarehouseId, f))
    .map((c) => {
      const b = balances.get(c.id)!;
      return {
        customerId: c.id,
        name: c.name,
        area: c.area,
        warehouseId: c.homeWarehouseId,
        balance: b.balance,
        creditLimit: c.creditLimit,
        daysSincePayment: daysSincePaid(ds.today, b),
      };
    })
    .filter((d) => d.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, limit);
}

/* ───────────── التنبيهات الذكية ───────────── */

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertKind = "lot_low" | "overdue" | "stagnant" | "missing_color" | "advance_high";

export interface DashboardAlert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  detail: string;
  warehouseId?: WarehouseId;
}

export function buildAlerts(ds: DemoDataset, ix: Indexes, f: WarehouseFilter): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  const month = monthOf(ds.today);
  const winterActive = month >= 9 || month <= 2;
  const activeSeason = winterActive ? "winter" : "summer";

  // 1) طبخات قربت تخلص في صنف موسمه شغال
  const lotRemaining = new Map<string, number>();
  const lastSaleOfLot = new Map<string, IsoDate>();
  for (const r of ds.rolls) {
    const k = `${r.lotId}|${r.warehouseId}`;
    if (r.status === "available") lotRemaining.set(k, (lotRemaining.get(k) ?? 0) + 1);
    if (r.status === "sold" && r.soldOn) {
      const prev = lastSaleOfLot.get(r.lotId);
      if (!prev || r.soldOn > prev) lastSaleOfLot.set(r.lotId, r.soldOn);
    }
  }
  const lowLots: { lot: DyeLot; wh: WarehouseId; left: number }[] = [];
  for (const [k, left] of lotRemaining) {
    const [lotId, wh] = k.split("|") as [string, WarehouseId];
    const lot = ix.lotById.get(lotId);
    if (!lot || !matchWh(wh, f) || left > 2) continue;
    const item = ix.itemById.get(lot.itemId);
    if (item?.season !== activeSeason || lot.rollCount < 8) continue;
    const recent = lastSaleOfLot.get(lotId);
    if (!recent || diffDays(ds.today, recent) > 21) continue;
    lowLots.push({ lot, wh, left });
  }
  lowLots
    .sort((a, b) => a.left - b.left)
    .slice(0, 3)
    .forEach(({ lot, wh, left }) => {
      const item = ix.itemById.get(lot.itemId)!;
      const color = ix.colorById.get(lot.colorId)?.name ?? "";
      alerts.push({
        id: `low-${lot.id}-${wh}`,
        kind: "lot_low",
        severity: left === 1 ? "critical" : "warning",
        title: `طبخة ${lot.code} قربت تخلص`,
        detail: `${item.name} ${color} — باقي ${left === 1 ? "توب واحد" : "2 توب"} في ${wh === "kerdasa" ? "كرداسة" : "المحلة"}`,
        warehouseId: wh,
      });
    });

  // 2) عملاء متأخرين في السداد
  const balances = customerBalances(ds);
  ds.customers
    .filter((c) => matchWh(c.homeWarehouseId, f))
    .map((c) => ({ c, b: balances.get(c.id)! }))
    .filter(({ b }) => b.balance > 20_000 && (daysSincePaid(ds.today, b) ?? 0) > 40)
    .sort((x, y) => y.b.balance - x.b.balance)
    .slice(0, 3)
    .forEach(({ c, b }) => {
      const days = daysSincePaid(ds.today, b) ?? 0;
      alerts.push({
        id: `overdue-${c.id}`,
        kind: "overdue",
        severity: days > 60 ? "critical" : "warning",
        title: `${c.name} متأخر في السداد`,
        detail: `آخر دفعة من ${days} يوم — الرصيد ${Math.round(b.balance).toLocaleString("en-US")} ج.م`,
        warehouseId: c.homeWarehouseId,
      });
    });

  // 3) ألوان ناقصة في صنف موسمه شغال
  for (const wh of ["kerdasa", "mahalla"] as const) {
    if (!matchWh(wh, f)) continue;
    const rows = assortmentReadiness(ds, ix, wh).filter((r) => r.inSeason && r.complete < r.total);
    rows.slice(0, 2).forEach((row) => {
      const missing = row.cells.filter((c) => c.rolls === 0).map((c) => c.name);
      alerts.push({
        id: `missing-${wh}-${row.itemId}`,
        kind: "missing_color",
        severity: "warning",
        title: `تشكيلة ${row.name} ناقصة في ${wh === "kerdasa" ? "كرداسة" : "المحلة"}`,
        detail: `مفيش: ${missing.join("، ")} — العميل اللي عايز اللون ده ممكن يروح لغيرك`,
        warehouseId: wh,
      });
    });
  }

  // 4) سلف عالية: الرصيد المفتوح أكبر من نص المرتب الشهري
  advanceBalances(ds, f)
    .filter((h) => h.outstanding > (h.payType === "weekly" ? h.wage * 4.33 : h.wage) * 0.5)
    .slice(0, 2)
    .forEach((h) => {
      alerts.push({
        id: `adv-${h.employeeId}`,
        kind: "advance_high",
        severity: "warning",
        title: `سلف ${h.name} عدّت نص مرتبه`,
        detail: `${h.jobTitle} — باقي عليه ${Math.round(h.outstanding).toLocaleString("en-US")} ج.م، والقسط ${Math.round(h.installment).toLocaleString("en-US")} ج.م كل قبضة`,
        warehouseId: h.warehouseId,
      });
    });

  // 5) مخزون الموسم اللي فات الراكد
  const offSeason = activeSeason === "winter" ? "summer" : "winter";
  let stagnantRolls = 0;
  let stagnantValue = 0;
  for (const r of ds.rolls) {
    if (r.status !== "available" || !matchWh(r.warehouseId, f)) continue;
    const item = ix.itemById.get(r.itemId);
    if (item?.season !== offSeason) continue;
    const lastSale = lastSaleOfLot.get(r.lotId);
    const idle = diffDays(ds.today, lastSale ?? r.receivedOn);
    if (idle < 45) continue;
    stagnantRolls++;
    stagnantValue += r.quantity * (ix.lotById.get(r.lotId)?.unitCost ?? 0);
  }
  if (stagnantRolls > 0) {
    alerts.push({
      id: "stagnant",
      kind: "stagnant",
      severity: "info",
      title: `${stagnantRolls} توب ${offSeason === "summer" ? "صيفي" : "شتوي"} راكد من أكتر من 45 يوم`,
      detail: `قيمتهم بالتكلفة حوالي ${Math.round(stagnantValue / 1000).toLocaleString("en-US")} ألف ج.م — فرصة لعرض تصفية`,
    });
  }

  const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

/* ───────────── آخر الفواتير والتحويلات ───────────── */

export interface InvoiceRow {
  id: string;
  number: string;
  date: IsoDate;
  warehouseId: WarehouseId;
  customer: string;
  summary: string;
  rolls: number;
  total: number;
  status: "paid" | "partial" | "credit";
}

export function recentInvoices(ds: DemoDataset, ix: Indexes, f: WarehouseFilter, limit = 7): InvoiceRow[] {
  const rows: InvoiceRow[] = [];
  for (let i = ds.salesInvoices.length - 1; i >= 0 && rows.length < limit; i--) {
    const inv = ds.salesInvoices[i]!;
    if (!matchWh(inv.warehouseId, f)) continue;
    const itemNames = [...new Set(inv.lines.map((l) => ix.itemById.get(l.itemId)?.name ?? ""))];
    const colors = new Set(inv.lines.map((l) => `${l.itemId}|${l.colorId}`)).size;
    rows.push({
      id: inv.id,
      number: inv.number,
      date: inv.date,
      warehouseId: inv.warehouseId,
      customer: ix.customerById.get(inv.customerId)?.name ?? "",
      summary: `${itemNames.join(" + ")} · ${colors} لون`,
      rolls: inv.rollCount,
      total: inv.total,
      status: inv.paidNow >= inv.total ? "paid" : inv.paidNow > 0 ? "partial" : "credit",
    });
  }
  return rows;
}

export interface TransferRow {
  transfer: StockTransfer;
  summary: string;
  rolls: number;
  quantityLabel: string;
}

export function transfersOverview(ds: DemoDataset, ix: Indexes, f: WarehouseFilter): { inTransit: TransferRow[]; recent: TransferRow[] } {
  const toRow = (t: StockTransfer): TransferRow => {
    const rolls = t.rollIds.map((id) => ix.rollById.get(id)).filter((r): r is Roll => Boolean(r));
    const first = rolls[0];
    const itemIds = [...new Set(rolls.map((r) => r.itemId))];
    const colorKeys = new Set(rolls.map((r) => `${r.itemId}|${r.colorId}`));
    let meters = 0;
    let kilos = 0;
    for (const r of rolls) {
      if (ix.itemById.get(r.itemId)?.unit === "kg") kilos += r.quantity;
      else meters += r.quantity;
    }
    let summary: string;
    if (itemIds.length === 1 && colorKeys.size === 1 && first) {
      const lot = ix.lotById.get(first.lotId);
      summary = `${ix.itemById.get(first.itemId)?.name ?? ""} ${ix.colorById.get(first.colorId)?.name ?? ""} · طبخة ${lot?.code ?? ""}`;
    } else {
      summary = `${itemIds.map((id) => ix.itemById.get(id)?.name ?? "").join(" + ")} · ${colorKeys.size} لون`;
    }
    const parts = [meters > 0 ? `${Math.round(meters)} م` : "", kilos > 0 ? `${Math.round(kilos)} كجم` : ""].filter(Boolean);
    return { transfer: t, summary, rolls: rolls.length, quantityLabel: parts.join(" + ") };
  };
  const relevant = ds.transfers.filter((t) => matchWh(t.fromWarehouseId, f) || matchWh(t.toWarehouseId, f));
  return {
    inTransit: relevant.filter((t) => t.status === "in_transit").reverse().map(toRow),
    recent: relevant.filter((t) => t.status === "received").slice(-3).reverse().map(toRow),
  };
}

/* ───────────── العمالة: المرتبات والسلف ───────────── */

export interface AdvanceBalance {
  employeeId: string;
  name: string;
  jobTitle: string;
  warehouseId: WarehouseId;
  payType: "monthly" | "weekly";
  wage: number;
  outstanding: number;
  installment: number;
  lastAdvanceOn: IsoDate;
}

export interface PayrollSummary {
  headcount: number;
  monthlyStaff: number;
  weeklyStaff: number;
  /** التكلفة الشهرية التقديرية للعمالة (الأسبوعيات × 4.33) */
  monthlyCost: number;
  /** المصروف فعلاً على المرتبات والأسبوعيات في الفترة */
  paidInPeriod: number;
  /** السلف اللي اتصرفت في الفترة */
  advancesInPeriod: number;
  advancesOutstanding: number;
  advanceHolders: AdvanceBalance[];
  nextWeekly: { date: IsoDate; net: number; deductions: number; count: number };
  nextMonthly: { date: IsoDate; net: number; deductions: number; count: number };
  /** نسبة تكلفة العمالة من المبيعات في الفترة */
  costToSalesPct: number | null;
}

function nextWeekday(from: IsoDate, wd: number): IsoDate {
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i);
    if (new Date(`${d}T00:00:00Z`).getUTCDay() === wd) return d;
  }
  return from;
}

function nextMonthStart(today: IsoDate): IsoDate {
  const [y, m] = today.split("-").map(Number) as [number, number];
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const first = `${ny}-${String(nm).padStart(2, "0")}-01`;
  return isFriday(first) ? addDays(first, 1) : first;
}

export function advanceBalances(ds: DemoDataset, f: WarehouseFilter): AdvanceBalance[] {
  const out = new Map<string, AdvanceBalance>();
  for (const a of ds.advances) {
    const emp = ds.employees.find((e) => e.id === a.employeeId);
    if (!emp || !matchWh(emp.warehouseId, f)) continue;
    const row =
      out.get(emp.id) ??
      {
        employeeId: emp.id,
        name: emp.name,
        jobTitle: emp.jobTitle,
        warehouseId: emp.warehouseId,
        payType: emp.payType,
        wage: emp.wage,
        outstanding: 0,
        installment: 0,
        lastAdvanceOn: a.date,
      };
    row.outstanding += a.amount;
    row.installment = a.installment;
    if (a.date > row.lastAdvanceOn) row.lastAdvanceOn = a.date;
    out.set(emp.id, row);
  }
  for (const p of ds.payroll) {
    const row = out.get(p.employeeId);
    if (row) row.outstanding -= p.advanceDeduction;
  }
  return [...out.values()]
    .map((r) => ({ ...r, outstanding: Math.round(r.outstanding) }))
    .filter((r) => r.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);
}

export function payrollSummary(ds: DemoDataset, f: WarehouseFilter, period: Period): PayrollSummary {
  const { current } = periodRange(ds.today, period);
  const staff = ds.employees.filter((e) => matchWh(e.warehouseId, f));
  const holders = advanceBalances(ds, f);
  const holderById = new Map(holders.map((h) => [h.employeeId, h]));

  const plan = (type: "monthly" | "weekly") => {
    let net = 0;
    let deductions = 0;
    const group = staff.filter((e) => e.payType === type);
    for (const e of group) {
      const h = holderById.get(e.id);
      const d = h ? Math.min(h.outstanding, h.installment, e.wage * 0.5) : 0;
      deductions += d;
      net += e.wage - d;
    }
    return { net, deductions, count: group.length };
  };

  let paidInPeriod = 0;
  for (const p of ds.payroll) if (inRange(p.date, current) && matchWh(p.warehouseId, f)) paidInPeriod += p.net;
  let advancesInPeriod = 0;
  for (const a of ds.advances) if (inRange(a.date, current) && matchWh(a.warehouseId, f)) advancesInPeriod += a.amount;

  const sales = sumSales(ds, current, f, (i) => i.total);
  const laborCost = paidInPeriod + ds.payroll
    .filter((p) => inRange(p.date, current) && matchWh(p.warehouseId, f))
    .reduce((s, p) => s + p.advanceDeduction, 0);

  return {
    headcount: staff.length,
    monthlyStaff: staff.filter((e) => e.payType === "monthly").length,
    weeklyStaff: staff.filter((e) => e.payType === "weekly").length,
    monthlyCost: staff.reduce((s, e) => s + (e.payType === "weekly" ? e.wage * 4.33 : e.wage), 0),
    paidInPeriod,
    advancesInPeriod,
    advancesOutstanding: holders.reduce((s, h) => s + h.outstanding, 0),
    advanceHolders: holders,
    nextWeekly: { date: nextWeekday(ds.today, 4), ...plan("weekly") },
    nextMonthly: { date: nextMonthStart(ds.today), ...plan("monthly") },
    costToSalesPct: sales > 0 ? (laborCost / sales) * 100 : null,
  };
}
