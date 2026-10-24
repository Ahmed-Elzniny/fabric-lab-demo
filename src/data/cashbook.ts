// src/data/cashbook.ts
// يومية الخزنة: رصيد أول اليوم، كل حركة بالرصيد المتراكم، ورصيد آخر اليوم.
// وتسجيل مصروف، وتقفيل اليومية بالعدّ الفعلي (لو فيه عجز أو زيادة بتتسجل تسوية).
// في DRF: GET /api/cashboxes/{id}/journal?date= ، POST /api/cashboxes/{id}/expenses ، POST /api/cashboxes/{id}/closings
import { addDays, isFriday, type IsoDate } from "@/lib/dates";
import { hitsCashBox } from "./selectors";
import type { CashClosing, CashKind, CashTransaction, DemoDataset, WarehouseId } from "./types";

export interface JournalEntry {
  tx: CashTransaction;
  balance: number;
}

export interface DayJournal {
  date: IsoDate;
  opening: number;
  inflow: number;
  outflow: number;
  closing: number;
  entries: JournalEntry[];
  closingRecord?: CashClosing;
}

export function dayJournal(ds: DemoDataset, wh: WarehouseId, date: IsoDate): DayJournal {
  let opening = ds.openingCash[wh];
  const today: CashTransaction[] = [];
  for (const t of ds.cash) {
    if (t.warehouseId !== wh || !hitsCashBox(t)) continue;
    if (t.date < date) opening += t.amount;
    else if (t.date === date) today.push(t);
  }
  let bal = opening;
  let inflow = 0;
  let outflow = 0;
  const entries = today.map((tx) => {
    bal += tx.amount;
    if (tx.amount > 0) inflow += tx.amount;
    else outflow -= tx.amount;
    return { tx, balance: bal };
  });
  return {
    date,
    opening,
    inflow,
    outflow,
    closing: bal,
    entries,
    closingRecord: (ds.closings ?? []).find((c) => c.warehouseId === wh && c.date === date),
  };
}

/** آخر N يوم شغل (الجمعة إجازة) — الأحدث الأول */
export function recentWorkDays(today: IsoDate, n: number): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = today; out.length < n; d = addDays(d, -1)) if (!isFriday(d)) out.push(d);
  return out;
}

export class CashbookError extends Error {}

export const EXPENSE_CATEGORIES = ["نقل وتحميل", "كهرباء ومياه", "شاي وضيافة", "صيانة رفوف", "أكياس وتغليف", "بنزين العربية", "إيجار", "نثريات"];

export function commitExpense(
  ds: DemoDataset,
  d: { warehouseId: WarehouseId; amount: number; category: string; note: string; createdBy: string },
): DemoDataset {
  const amount = Math.round(d.amount * 100) / 100;
  if (!(amount > 0)) throw new CashbookError("اكتب مبلغ المصروف.");
  const bal = dayJournal(ds, d.warehouseId, ds.today).closing;
  if (amount > bal) throw new CashbookError(`الخزنة فيها ${Math.round(bal).toLocaleString("en-US")} ج.م بس.`);
  const note = d.note.trim();
  return {
    ...ds,
    cash: [
      ...ds.cash,
      {
        id: `cash-u-exp-${ds.cash.length + 1}`,
        date: ds.today,
        warehouseId: d.warehouseId,
        kind: "expense",
        amount: -amount,
        note: note ? `${d.category} — ${note}` : d.category,
      },
    ],
  };
}

export function commitClosing(
  ds: DemoDataset,
  d: { warehouseId: WarehouseId; counted: number; note: string; closedBy: string },
): { ds: DemoDataset; closing: CashClosing } {
  if (!(d.counted >= 0)) throw new CashbookError("اكتب المبلغ اللي اتعدّ في الخزنة.");
  const j = dayJournal(ds, d.warehouseId, ds.today);
  if (j.closingRecord) throw new CashbookError("يومية النهارده اتقفلت قبل كده.");
  const counted = Math.round(d.counted * 100) / 100;
  const raw = Math.round((counted - j.closing) * 100) / 100;
  // فروق القروش مش بتتحسب
  const difference = Math.abs(raw) < 1 ? 0 : raw;
  const closing: CashClosing = {
    id: `close-${d.warehouseId}-${ds.today}`,
    date: ds.today,
    warehouseId: d.warehouseId,
    expected: j.closing,
    counted,
    difference,
    note: d.note.trim() || undefined,
    closedBy: d.closedBy,
  };
  const cash = [...ds.cash];
  if (Math.abs(difference) >= 1) {
    const kind: CashKind = "adjustment";
    cash.push({
      id: `cash-u-adj-${ds.cash.length + 1}`,
      date: ds.today,
      warehouseId: d.warehouseId,
      kind,
      amount: difference,
      note: difference < 0 ? `عجز في جرد الخزنة — ${closing.closedBy}` : `زيادة في جرد الخزنة — ${closing.closedBy}`,
    });
  }
  return { ds: { ...ds, cash, closings: [...(ds.closings ?? []), closing] }, closing };
}
