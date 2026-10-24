// src/data/customers.ts
// حسابات العملاء: كشف الحساب بالرصيد المتراكم، وأعمار الديون، وتسجيل التحصيل.
// الرصيد مش متخزّن — بيتحسب دايماً من الفواتير والتحصيلات، فمستحيل يتلخبط.
// في DRF: /api/customers/ ، /api/customers/{id}/statement ، POST /api/customers/{id}/collections
import { diffDays, type IsoDate } from "@/lib/dates";
import type { Indexes, WarehouseFilter } from "./selectors";
import { customerBalances, daysSincePaid } from "./selectors";
import type { CashTransaction, Customer, DemoDataset, PaymentMethod, WarehouseId } from "./types";

/* ───────────── أعمار الديون (Aging) ───────────── */

export type AgingBucket = "b30" | "b60" | "b90" | "b90p";
export const AGING_BUCKETS: { key: AgingBucket; label: string; short: string }[] = [
  { key: "b30", label: "أقل من 30 يوم", short: "0–30" },
  { key: "b60", label: "31 – 60 يوم", short: "31–60" },
  { key: "b90", label: "61 – 90 يوم", short: "61–90" },
  { key: "b90p", label: "أكتر من 90 يوم", short: "+90" },
];

export type Aging = Record<AgingBucket, number>;
const emptyAging = (): Aging => ({ b30: 0, b60: 0, b90: 0, b90p: 0 });

function bucketOf(days: number): AgingBucket {
  if (days <= 30) return "b30";
  if (days <= 60) return "b60";
  if (days <= 90) return "b90";
  return "b90p";
}

/**
 * أعمار الديون بطريقة FIFO: كل فلوس العميل (نقدي مع الفاتورة + تحصيلات) بتسدّد أقدم فاتورة الأول،
 * واللي فاضل من كل فاتورة بيتحسب عمره من تاريخها.
 */
export function agingByCustomer(ds: DemoDataset): Map<string, Aging> {
  const invoices = new Map<string, { date: IsoDate; total: number }[]>();
  for (const inv of ds.salesInvoices) {
    const list = invoices.get(inv.customerId) ?? [];
    list.push({ date: inv.date, total: inv.total });
    invoices.set(inv.customerId, list);
  }
  const credits = new Map<string, number>();
  for (const t of ds.cash) {
    if (!t.partyId || (t.kind !== "collection" && t.kind !== "cash_sale")) continue;
    credits.set(t.partyId, (credits.get(t.partyId) ?? 0) + t.amount);
  }
  const out = new Map<string, Aging>();
  for (const c of ds.customers) {
    const aging = emptyAging();
    let credit = credits.get(c.id) ?? 0;
    const list = (invoices.get(c.id) ?? []).sort((a, b) => (a.date < b.date ? -1 : 1));
    for (const inv of list) {
      const paid = Math.min(credit, inv.total);
      credit -= paid;
      const open = inv.total - paid;
      if (open > 0.5) aging[bucketOf(diffDays(ds.today, inv.date))] += open;
    }
    out.set(c.id, aging);
  }
  return out;
}

export function sumAging(list: Aging[]): Aging {
  const a = emptyAging();
  for (const x of list) for (const k of Object.keys(a) as AgingBucket[]) a[k] += x[k];
  return a;
}

/* ───────────── قائمة العملاء ───────────── */

export interface CustomerRow {
  customer: Customer;
  balance: number;
  aging: Aging;
  overdue: number; // أكتر من 60 يوم
  daysSincePayment: number | null;
  lastInvoice: IsoDate | null;
  purchases90: number;
  overLimit: boolean;
}

export function customerRows(ds: DemoDataset, f: WarehouseFilter): CustomerRow[] {
  const balances = customerBalances(ds);
  const aging = agingByCustomer(ds);
  const p90 = new Map<string, number>();
  for (const inv of ds.salesInvoices) {
    if (diffDays(ds.today, inv.date) <= 90) p90.set(inv.customerId, (p90.get(inv.customerId) ?? 0) + inv.total);
  }
  return ds.customers
    .filter((c) => f === "all" || c.homeWarehouseId === f)
    .map((c) => {
      const b = balances.get(c.id)!;
      const a = aging.get(c.id) ?? emptyAging();
      return {
        customer: c,
        balance: b.balance,
        aging: a,
        overdue: a.b90 + a.b90p,
        daysSincePayment: daysSincePaid(ds.today, b),
        lastInvoice: b.lastInvoice,
        purchases90: p90.get(c.id) ?? 0,
        overLimit: b.balance > c.creditLimit,
      };
    })
    .sort((a, b) => b.balance - a.balance);
}

/* ───────────── كشف الحساب (Statement) ───────────── */

export interface LedgerEntry {
  id: string;
  date: IsoDate;
  kind: "invoice" | "payment_with_invoice" | "collection";
  description: string;
  debit: number;
  credit: number;
  balance: number;
  invoiceId?: string;
  warehouseId: WarehouseId;
  method?: PaymentMethod;
}

const METHOD_LABEL: Record<PaymentMethod, string> = { cash: "نقدي", bank: "تحويل بنكي", instapay: "إنستاباي" };

export function customerLedger(ds: DemoDataset, ix: Indexes, customerId: string): LedgerEntry[] {
  const raw: Omit<LedgerEntry, "balance">[] = [];
  for (const inv of ds.salesInvoices) {
    if (inv.customerId !== customerId) continue;
    const items = [...new Set(inv.lines.map((l) => ix.itemById.get(l.itemId)?.name ?? ""))].join(" + ");
    raw.push({
      id: inv.id,
      date: inv.date,
      kind: "invoice",
      description: `فاتورة ${inv.number} — ${items} · ${inv.rollCount} توب`,
      debit: inv.total,
      credit: 0,
      invoiceId: inv.id,
      warehouseId: inv.warehouseId,
    });
  }
  for (const t of ds.cash) {
    if (t.partyId !== customerId) continue;
    if (t.kind === "cash_sale") {
      const num = t.note.match(/INV-\d+/)?.[0] ?? "";
      raw.push({
        id: t.id,
        date: t.date,
        kind: "payment_with_invoice",
        description: `دفعة نقدي مع فاتورة ${num}`,
        debit: 0,
        credit: t.amount,
        invoiceId: ds.salesInvoices.find((i) => i.number === num)?.id,
        warehouseId: t.warehouseId,
        method: "cash",
      });
    } else if (t.kind === "collection") {
      const extra = t.note.split(" — ")[1];
      raw.push({
        id: t.id,
        date: t.date,
        kind: "collection",
        description: `تحصيل ${METHOD_LABEL[t.method ?? "cash"]}${extra ? ` — ${extra}` : ""}`,
        debit: 0,
        credit: t.amount,
        warehouseId: t.warehouseId,
        method: t.method ?? "cash",
      });
    }
  }
  // الترتيب: بالتاريخ، والفاتورة قبل دفعتها في نفس اليوم
  const order = { invoice: 0, payment_with_invoice: 1, collection: 2 } as const;
  raw.sort((a, b) => (a.date === b.date ? order[a.kind] - order[b.kind] : a.date < b.date ? -1 : 1));
  let bal = 0;
  return raw.map((e) => {
    bal += e.debit - e.credit;
    return { ...e, balance: Math.round(bal * 100) / 100 };
  });
}

/* ───────────── تسجيل التحصيل ───────────── */

export class CollectionError extends Error {}

export interface CollectionDraft {
  customerId: string;
  warehouseId: WarehouseId;
  amount: number;
  method: PaymentMethod;
  note: string;
  createdBy: string;
}

export function commitCollection(ds: DemoDataset, ix: Indexes, d: CollectionDraft): { ds: DemoDataset; tx: CashTransaction } {
  const c = ix.customerById.get(d.customerId);
  if (!c) throw new CollectionError("اختار العميل.");
  const amount = Math.round(d.amount * 100) / 100;
  if (!(amount > 0)) throw new CollectionError("اكتب مبلغ أكبر من صفر.");
  const balance = customerBalances(ds).get(c.id)?.balance ?? 0;
  if (amount > balance + 0.5) {
    throw new CollectionError(`المبلغ أكبر من رصيد العميل (${Math.round(balance).toLocaleString("en-US")} ج.م).`);
  }
  const note = d.note.trim();
  const tx: CashTransaction = {
    id: `cash-u-col-${ds.cash.length + 1}`,
    date: ds.today,
    warehouseId: d.warehouseId,
    kind: "collection",
    amount,
    note: `تحصيل من ${c.name}${note ? ` — ${note}` : ""}`,
    partyId: c.id,
    method: d.method,
  };
  return { ds: { ...ds, cash: [...ds.cash, tx] }, tx };
}

/* ───────────── كشف حساب نصي (للنسخ على واتساب) ───────────── */

export function statementText(c: Customer, ledger: LedgerEntry[], businessName: string, last = 8): string {
  const fmt = (n: number) => `${Math.round(n).toLocaleString("en-US")} ج.م`;
  const lines = [`*${businessName}*`, `كشف حساب: ${c.name}`, ""];
  const tail = ledger.slice(-last);
  const prev = ledger.length > tail.length ? ledger[ledger.length - tail.length - 1]!.balance : 0;
  if (ledger.length > tail.length) lines.push(`رصيد سابق: ${fmt(prev)}`);
  for (const e of tail) {
    const amt = e.debit > 0 ? `+${fmt(e.debit)}` : `−${fmt(e.credit)}`;
    lines.push(`${e.date} · ${e.description} · ${amt}`);
  }
  lines.push("", `*الرصيد المستحق: ${fmt(ledger.at(-1)?.balance ?? 0)}*`);
  return lines.join("\n");
}
