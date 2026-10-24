// src/data/inventory.ts
// المخزون بالتفصيل: الصنف ← الطبخة ← التوب، والبحث بكود التوب أو رقم الطبخة.
// دوال نقية (Pure Functions) — هتبقى endpoints في DRF: /api/inventory/items, /api/lots/{id}, /api/rolls/lookup?code=
import { diffDays, type IsoDate } from "@/lib/dates";
import type { Indexes, WarehouseFilter } from "./selectors";
import type { DemoDataset, DyeLot, Item, Roll, SalesInvoice, StockTransfer, WarehouseId } from "./types";

export type LotStatus = "new" | "active" | "low" | "stagnant" | "finished";

export const LOT_STATUS_META: Record<LotStatus, { label: string; cls: string }> = {
  new: { label: "جديدة", cls: "chip--info" },
  active: { label: "شغالة", cls: "chip--good" },
  low: { label: "قربت تخلص", cls: "chip--warn" },
  stagnant: { label: "راكدة", cls: "chip--crit" },
  finished: { label: "خلصت", cls: "chip--flat" },
};

export interface LotRow {
  lot: DyeLot;
  colorName: string;
  colorHex: string;
  supplierName: string;
  /** التواب المتاحة في نطاق الفلتر */
  available: number;
  availableQty: number;
  inTransit: number;
  sold: number;
  byWarehouse: Record<WarehouseId, number>;
  lastSale: IsoDate | null;
  ageDays: number;
  status: LotStatus;
}

export interface ItemRow {
  item: Item;
  rolls: number;
  qty: number;
  value: number;
  inTransit: number;
  colorsAvailable: number;
  byWarehouse: Record<WarehouseId, number>;
  lots: LotRow[];
}

const STAGNANT_DAYS = 45;

function lotStatus(available: number, original: number, ageDays: number, idleDays: number): LotStatus {
  if (available === 0) return "finished";
  if (ageDays <= 7) return "new";
  if (idleDays >= STAGNANT_DAYS) return "stagnant";
  if (available <= 2 && original >= 4) return "low";
  return "active";
}

export function inventoryByItem(ds: DemoDataset, ix: Indexes, f: WarehouseFilter): ItemRow[] {
  const inScope = (w: WarehouseId) => f === "all" || f === w;

  // تجميع التواب حسب الطبخة مرة واحدة
  const perLot = new Map<string, { available: Roll[]; inTransit: number; sold: number; lastSale: IsoDate | null; byWh: Record<WarehouseId, number> }>();
  for (const r of ds.rolls) {
    let e = perLot.get(r.lotId);
    if (!e) {
      e = { available: [], inTransit: 0, sold: 0, lastSale: null, byWh: { kerdasa: 0, mahalla: 0 } };
      perLot.set(r.lotId, e);
    }
    if (r.status === "sold") {
      e.sold++;
      if (r.soldOn && (!e.lastSale || r.soldOn > e.lastSale)) e.lastSale = r.soldOn;
    } else if (r.status === "in_transit") {
      if (inScope(r.warehouseId)) e.inTransit++;
    } else if (r.status === "available") {
      e.byWh[r.warehouseId]++;
      if (inScope(r.warehouseId)) e.available.push(r);
    }
  }

  const supplierName = new Map(ds.suppliers.map((s) => [s.id, s.name]));
  const rows = new Map<string, ItemRow>();
  for (const item of ds.items) {
    rows.set(item.id, {
      item,
      rolls: 0,
      qty: 0,
      value: 0,
      inTransit: 0,
      colorsAvailable: 0,
      byWarehouse: { kerdasa: 0, mahalla: 0 },
      lots: [],
    });
  }

  for (const lot of ds.lots) {
    const e = perLot.get(lot.id);
    const row = rows.get(lot.itemId);
    if (!e || !row) continue;
    const color = ix.colorById.get(lot.colorId);
    const availableQty = e.available.reduce((s, r) => s + r.quantity, 0);
    const ageDays = diffDays(ds.today, lot.receivedOn);
    const idleDays = diffDays(ds.today, e.lastSale ?? lot.receivedOn);
    const lr: LotRow = {
      lot,
      colorName: color?.name ?? "",
      colorHex: color?.hex ?? "#999",
      supplierName: supplierName.get(lot.supplierId) ?? "",
      available: e.available.length,
      availableQty,
      inTransit: e.inTransit,
      sold: e.sold,
      byWarehouse: e.byWh,
      lastSale: e.lastSale,
      ageDays,
      status: lotStatus(e.available.length, lot.rollCount, ageDays, idleDays),
    };
    row.lots.push(lr);
    row.rolls += lr.available;
    row.qty += availableQty;
    row.value += availableQty * lot.unitCost;
    row.inTransit += lr.inTransit;
    row.byWarehouse.kerdasa += e.byWh.kerdasa;
    row.byWarehouse.mahalla += e.byWh.mahalla;
  }

  for (const row of rows.values()) {
    row.colorsAvailable = new Set(row.lots.filter((l) => l.available > 0).map((l) => l.lot.colorId)).size;
    // الطبخات المتاحة الأول، والأقدم قبل الأحدث (FIFO) جوه كل لون
    row.lots.sort(
      (a, b) =>
        Number(b.available > 0) - Number(a.available > 0) ||
        row.item.colorIds.indexOf(a.lot.colorId) - row.item.colorIds.indexOf(b.lot.colorId) ||
        (a.lot.receivedOn < b.lot.receivedOn ? -1 : 1),
    );
  }
  return [...rows.values()];
}

/* ───────────── البحث بكود التوب ───────────── */

export interface RollLookup {
  roll: Roll;
  lot: DyeLot;
  item: Item;
  colorName: string;
  colorHex: string;
  invoice?: SalesInvoice;
  customerName?: string;
  transfer?: StockTransfer;
}

export const ROLL_CODE_RE = /^\d{4}-\d{1,2}$/;
export const LOT_CODE_RE = /^\d{4}$/;

/** بيقبل 2762-7 أو 2762-07 أو مسافات زيادة */
export function normalizeRollCode(q: string): string | null {
  const m = q.trim().replace(/\s+/g, "").match(/^(\d{4})-(\d{1,2})$/);
  return m ? `${m[1]}-${m[2]!.padStart(2, "0")}` : null;
}

export function lookupRoll(ds: DemoDataset, ix: Indexes, code: string): RollLookup | null {
  const roll = ds.rolls.find((r) => r.code === code);
  if (!roll) return null;
  const lot = ix.lotById.get(roll.lotId);
  const item = ix.itemById.get(roll.itemId);
  if (!lot || !item) return null;
  const color = ix.colorById.get(roll.colorId);
  const out: RollLookup = { roll, lot, item, colorName: color?.name ?? "", colorHex: color?.hex ?? "#999" };
  if (roll.status === "sold" && roll.invoiceId) {
    out.invoice = ds.salesInvoices.find((i) => i.id === roll.invoiceId);
    if (out.invoice) out.customerName = ix.customerById.get(out.invoice.customerId)?.name;
  }
  // آخر تحويل اتنقل فيه التوب ده
  for (let i = ds.transfers.length - 1; i >= 0; i--) {
    const t = ds.transfers[i]!;
    if (t.rollIds.includes(roll.id)) {
      out.transfer = t;
      break;
    }
  }
  return out;
}

/* ───────────── تفاصيل الطبخة ───────────── */

export interface LotDetail {
  lot: DyeLot;
  item: Item;
  colorName: string;
  colorHex: string;
  supplierName: string;
  rolls: Roll[];
  available: Roll[];
  inTransit: { roll: Roll; transfer?: StockTransfer }[];
  sold: { roll: Roll; invoice?: SalesInvoice; customerName?: string }[];
  totalQty: number;
}

export function lotDetail(ds: DemoDataset, ix: Indexes, lotId: string): LotDetail | null {
  const lot = ix.lotById.get(lotId);
  const item = lot ? ix.itemById.get(lot.itemId) : undefined;
  if (!lot || !item) return null;
  const rolls = ds.rolls.filter((r) => r.lotId === lotId).sort((a, b) => (a.code < b.code ? -1 : 1));
  const color = ix.colorById.get(lot.colorId);
  const invoiceById = new Map(ds.salesInvoices.map((i) => [i.id, i]));
  const transferOf = (rid: string) => {
    for (let i = ds.transfers.length - 1; i >= 0; i--) if (ds.transfers[i]!.rollIds.includes(rid)) return ds.transfers[i];
    return undefined;
  };
  return {
    lot,
    item,
    colorName: color?.name ?? "",
    colorHex: color?.hex ?? "#999",
    supplierName: ds.suppliers.find((s) => s.id === lot.supplierId)?.name ?? "",
    rolls,
    available: rolls.filter((r) => r.status === "available"),
    inTransit: rolls.filter((r) => r.status === "in_transit").map((roll) => ({ roll, transfer: transferOf(roll.id) })),
    sold: rolls
      .filter((r) => r.status === "sold")
      .map((roll) => {
        const invoice = roll.invoiceId ? invoiceById.get(roll.invoiceId) : undefined;
        return { roll, invoice, customerName: invoice ? ix.customerById.get(invoice.customerId)?.name : undefined };
      })
      .sort((a, b) => ((a.roll.soldOn ?? "") < (b.roll.soldOn ?? "") ? 1 : -1)),
    totalQty: rolls.reduce((s, r) => s + r.quantity, 0),
  };
}
