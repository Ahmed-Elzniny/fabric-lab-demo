// src/data/activity.ts
// سجل العمليات: كل حاجة اتعملت في الجلسة دي، باسم اللي عملها — "مين عمل إيه وإمتى".
// في النسخة الحقيقية: جدول AuditLog في Django بيتملى من signals، ومش بيتعدّل ولا يتمسح.
import type { Indexes } from "./selectors";
import type { DemoDataset } from "./types";

export type ActivityKind = "sale" | "purchase" | "transfer" | "receive" | "collection" | "cash" | "payroll" | "advance" | "closing" | "expense" | "supplier";

export interface Activity {
  id: string;
  date: string;
  who: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  amount?: number;
}

const WH = { kerdasa: "كرداسة", mahalla: "المحلة" } as const;

export function activityLog(ds: DemoDataset, ix: Indexes): Activity[] {
  const out: Activity[] = [];
  for (const inv of ds.salesInvoices) {
    if (!inv.createdBy) continue;
    out.push({ id: inv.id, date: inv.date, who: inv.createdBy, kind: "sale", title: `فاتورة بيع ${inv.number}`, detail: `${ix.customerById.get(inv.customerId)?.name ?? ""} · ${inv.rollCount} توب · مخزن ${WH[inv.warehouseId]}`, amount: inv.total });
  }
  for (const p of ds.purchaseInvoices) {
    if (!p.createdBy) continue;
    out.push({ id: p.id, date: p.date, who: p.createdBy, kind: "purchase", title: `استلام بضاعة ${p.number}`, detail: `${ds.suppliers.find((s) => s.id === p.supplierId)?.name ?? ""} · ${p.lotIds.length} طبخة · مخزن ${WH[p.warehouseId]}`, amount: p.total });
  }
  for (const t of ds.transfers) {
    if (t.createdBy) out.push({ id: `${t.id}-s`, date: t.date, who: t.createdBy, kind: "transfer", title: `تحويل ${t.number}`, detail: `${WH[t.fromWarehouseId]} ← ${WH[t.toWarehouseId]} · ${t.rollIds.length} توب · ${t.driver}` });
    if (t.receivedBy) out.push({ id: `${t.id}-r`, date: t.receivedOn ?? t.date, who: t.receivedBy, kind: "receive", title: `استلام تحويل ${t.number}`, detail: `${t.rollIds.length} توب دخلوا ${WH[t.toWarehouseId]}` });
  }
  const payrollRuns = new Map<string, { who: string; date: string; label: string; count: number; total: number }>();
  for (const p of ds.payroll) {
    if (!p.createdBy) continue;
    const k = `${p.periodLabel}|${p.date}`;
    const r = payrollRuns.get(k) ?? { who: p.createdBy, date: p.date, label: p.periodLabel, count: 0, total: 0 };
    r.count++;
    r.total += p.net;
    payrollRuns.set(k, r);
  }
  for (const [k, r] of payrollRuns) out.push({ id: `pay-${k}`, date: r.date, who: r.who, kind: "payroll", title: `صرف ${r.label}`, detail: `${r.count} موظف وعامل`, amount: r.total });
  for (const a of ds.advances) {
    if (!a.createdBy) continue;
    out.push({ id: a.id, date: a.date, who: a.createdBy, kind: "advance", title: "سلفة", detail: `${ds.employees.find((e) => e.id === a.employeeId)?.name ?? ""} · قسط ${a.installment}`, amount: a.amount });
  }
  for (const c of ds.closings ?? []) {
    out.push({ id: c.id, date: c.date, who: c.closedBy, kind: "closing", title: `تقفيل خزنة ${WH[c.warehouseId]}`, detail: c.difference === 0 ? "مظبوطة" : `${c.difference < 0 ? "عجز" : "زيادة"} ${Math.round(Math.abs(c.difference)).toLocaleString("en-US")} ج.م`, amount: c.counted });
  }
  for (const t of ds.cash) {
    if (!t.createdBy) continue;
    if (t.kind === "collection") out.push({ id: t.id, date: t.date, who: t.createdBy, kind: "collection", title: "تحصيل من عميل", detail: t.note.replace("تحصيل من ", ""), amount: t.amount });
    else if (t.kind === "expense") out.push({ id: t.id, date: t.date, who: t.createdBy, kind: "expense", title: "مصروف", detail: `${t.note} · خزنة ${WH[t.warehouseId]}`, amount: -t.amount });
    else if (t.kind === "cash_transfer_out") out.push({ id: t.id, date: t.date, who: t.createdBy, kind: "cash", title: "تحويل نقدية", detail: t.note, amount: -t.amount });
    else if (t.kind === "supplier_payment" && t.note.startsWith("سداد")) out.push({ id: t.id, date: t.date, who: t.createdBy, kind: "supplier", title: "سداد مورد", detail: t.note.replace("سداد للمورد — ", ""), amount: -t.amount });
  }
  // الأحدث الأول — والعمليات اللي في نفس اليوم بترتيب تسجيلها (العكس)
  return out.reverse().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
