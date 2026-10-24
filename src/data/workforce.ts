// src/data/workforce.ts
// العمالة: صرف القبضة (أسبوعيات الخميس ومرتبات الشهر) مع خصم أقساط السلف، وتسجيل السلف، وكشف حساب الموظف.
// القبضة والسلفة بيتصرفوا من خزنة المخزن اللي الموظف شغال فيه.
// في DRF: POST /api/payroll/runs ، POST /api/advances ، GET /api/employees/{id}/statement
import { addDays, monthOf, type IsoDate } from "@/lib/dates";
import { advanceBalances, cashBoxBalance, hitsCashBox } from "./selectors";
import type { WarehouseFilter } from "./selectors";
import type { CashTransaction, DemoDataset, Employee, PayType, PayrollPayment, SalaryAdvance, WarehouseId } from "./types";

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const WH: Record<WarehouseId, string> = { kerdasa: "كرداسة", mahalla: "المحلة" };

export const monthlyEquivalent = (e: Pick<Employee, "payType" | "wage">) => (e.payType === "weekly" ? e.wage * 4.33 : e.wage);

/** الخميس الجاي (أو النهارده لو خميس) — آخر يوم في أسبوع الشغل */
export function weekEnding(today: IsoDate): IsoDate {
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i);
    if (new Date(`${d}T00:00:00Z`).getUTCDay() === 4) return d;
  }
  return today;
}

/** اسم فترة القبضة — بنفس صيغة البيانات التاريخية عشان نمنع الصرف مرتين */
export function periodLabelFor(type: PayType, today: IsoDate): string {
  if (type === "weekly") {
    const th = weekEnding(today);
    return `أسبوعية ${th.slice(8, 10)}/${th.slice(5, 7)}`;
  }
  return `مرتب شهر ${MONTHS_AR[monthOf(today) - 1]}`;
}

/* ───────────── قائمة الموظفين ───────────── */

export interface EmployeeRow {
  employee: Employee;
  outstanding: number;
  installment: number;
  lastPaid: IsoDate | null;
  lastAdvance: IsoDate | null;
  paidLast30: number;
}

export function employeeRows(ds: DemoDataset, f: WarehouseFilter): EmployeeRow[] {
  const holders = new Map(advanceBalances(ds, f).map((h) => [h.employeeId, h]));
  const since = addDays(ds.today, -30);
  return ds.employees
    .filter((e) => f === "all" || e.warehouseId === f)
    .map((e) => {
      const pays = ds.payroll.filter((p) => p.employeeId === e.id);
      const advs = ds.advances.filter((a) => a.employeeId === e.id);
      const h = holders.get(e.id);
      return {
        employee: e,
        outstanding: h?.outstanding ?? 0,
        installment: h?.installment ?? 0,
        lastPaid: pays.at(-1)?.date ?? null,
        lastAdvance: advs.at(-1)?.date ?? null,
        paidLast30: pays.filter((p) => p.date >= since).reduce((s, p) => s + p.net, 0),
      };
    })
    .sort((a, b) => (a.employee.warehouseId === b.employee.warehouseId ? (a.employee.payType === b.employee.payType ? b.employee.wage - a.employee.wage : a.employee.payType === "monthly" ? -1 : 1) : a.employee.warehouseId === "kerdasa" ? -1 : 1));
}

/* ───────────── صرف القبضة ───────────── */

export interface PayrollPreviewRow {
  employee: Employee;
  outstanding: number;
  suggestedDeduction: number;
  alreadyPaid: boolean;
}

export function payrollPreview(ds: DemoDataset, type: PayType, f: WarehouseFilter): { label: string; rows: PayrollPreviewRow[] } {
  const label = periodLabelFor(type, ds.today);
  const holders = new Map(advanceBalances(ds, "all").map((h) => [h.employeeId, h]));
  const rows = ds.employees
    .filter((e) => e.payType === type && (f === "all" || e.warehouseId === f))
    .map((e) => {
      const h = holders.get(e.id);
      const outstanding = h?.outstanding ?? 0;
      return {
        employee: e,
        outstanding,
        suggestedDeduction: Math.min(outstanding, h?.installment ?? 0, e.wage * 0.5),
        alreadyPaid: ds.payroll.some((p) => p.employeeId === e.id && p.periodLabel === label),
      };
    });
  return { label, rows };
}

export class WorkforceError extends Error {}

export interface PayrollLineInput {
  employeeId: string;
  deduction: number;
  bonus: number;
  penalty: number;
}

export function payrollNet(wage: number, l: Pick<PayrollLineInput, "deduction" | "bonus" | "penalty">) {
  return Math.round((wage + (l.bonus || 0) - (l.penalty || 0) - (l.deduction || 0)) * 100) / 100;
}

export function commitPayroll(
  ds: DemoDataset,
  input: { type: PayType; lines: PayrollLineInput[]; createdBy: string },
): { ds: DemoDataset; payments: PayrollPayment[] } {
  if (input.lines.length === 0) throw new WorkforceError("اختار موظف واحد على الأقل.");
  const label = periodLabelFor(input.type, ds.today);
  const holders = new Map(advanceBalances(ds, "all").map((h) => [h.employeeId, h]));
  const needByWh: Record<WarehouseId, number> = { kerdasa: 0, mahalla: 0 };
  const payments: PayrollPayment[] = [];
  const cash: CashTransaction[] = [];
  let seq = ds.payroll.length;

  for (const l of input.lines) {
    const e = ds.employees.find((x) => x.id === l.employeeId);
    if (!e) throw new WorkforceError("موظف غير معروف.");
    if (e.payType !== input.type) throw new WorkforceError(`${e.name} مش على ${input.type === "weekly" ? "الأسبوعيات" : "المرتبات الشهرية"}.`);
    if (ds.payroll.some((p) => p.employeeId === e.id && p.periodLabel === label)) {
      throw new WorkforceError(`${e.name} اتصرف له ${label} قبل كده.`);
    }
    const outstanding = holders.get(e.id)?.outstanding ?? 0;
    if (l.deduction < 0 || l.bonus < 0 || l.penalty < 0) throw new WorkforceError("مينفعش أرقام بالسالب.");
    if (l.deduction > outstanding + 0.5) throw new WorkforceError(`خصم السلفة لـ ${e.name} أكبر من الباقي عليه (${Math.round(outstanding)} ج.م).`);
    const net = payrollNet(e.wage, l);
    if (net < 0) throw new WorkforceError(`صافي ${e.name} بالسالب — قلل الخصم.`);
    needByWh[e.warehouseId] += net;
    const p: PayrollPayment = {
      id: `pay-u-${++seq}`,
      employeeId: e.id,
      warehouseId: e.warehouseId,
      date: ds.today,
      payType: e.payType,
      periodLabel: label,
      gross: e.wage,
      advanceDeduction: Math.round(l.deduction * 100) / 100,
      net,
      bonus: l.bonus || undefined,
      penalty: l.penalty || undefined,
      createdBy: input.createdBy,
    };
    payments.push(p);
    if (net > 0) {
      cash.push({
        id: `cash-u-sal-${seq}`,
        date: ds.today,
        warehouseId: e.warehouseId,
        kind: "salary",
        amount: -net,
        note: `${label} — ${e.name}`,
        partyId: e.id,
      });
    }
  }

  for (const w of ["kerdasa", "mahalla"] as const) {
    const bal = cashBoxBalance(ds, w);
    if (needByWh[w] > bal) {
      throw new WorkforceError(`خزنة ${WH[w]} فيها ${Math.round(bal).toLocaleString("en-US")} ج.م بس، والقبضة محتاجة ${Math.round(needByWh[w]).toLocaleString("en-US")} ج.م.`);
    }
  }
  return { ds: { ...ds, payroll: [...ds.payroll, ...payments], cash: [...ds.cash, ...cash] }, payments };
}

/* ───────────── السلف ───────────── */

export interface AdvanceDraft {
  employeeId: string;
  amount: number;
  installment: number;
  note: string;
  createdBy: string;
}

export function commitAdvance(ds: DemoDataset, d: AdvanceDraft): { ds: DemoDataset; advance: SalaryAdvance } {
  const e = ds.employees.find((x) => x.id === d.employeeId);
  if (!e) throw new WorkforceError("اختار الموظف.");
  const amount = Math.round(d.amount * 100) / 100;
  if (!(amount > 0)) throw new WorkforceError("اكتب مبلغ السلفة.");
  if (!(d.installment > 0)) throw new WorkforceError("اكتب قيمة القسط اللي هيتخصم كل قبضة.");
  if (d.installment > e.wage) throw new WorkforceError(`القسط أكبر من ${e.payType === "weekly" ? "الأسبوعية" : "المرتب"} (${e.wage.toLocaleString("en-US")} ج.م).`);
  const bal = cashBoxBalance(ds, e.warehouseId);
  if (amount > bal) throw new WorkforceError(`خزنة ${WH[e.warehouseId]} فيها ${Math.round(bal).toLocaleString("en-US")} ج.م بس.`);
  const advance: SalaryAdvance = {
    id: `adv-u-${ds.advances.length + 1}`,
    employeeId: e.id,
    warehouseId: e.warehouseId,
    date: ds.today,
    amount,
    installment: Math.round(d.installment * 100) / 100,
    note: d.note.trim() || "سلفة",
    createdBy: d.createdBy,
  };
  const tx: CashTransaction = {
    id: `cash-u-adv-${ds.advances.length + 1}`,
    date: ds.today,
    warehouseId: e.warehouseId,
    kind: "advance",
    amount: -amount,
    note: `سلفة — ${e.name}`,
    partyId: e.id,
  };
  return { ds: { ...ds, advances: [...ds.advances, advance], cash: [...ds.cash, tx] }, advance };
}

/* ───────────── كشف حساب الموظف ───────────── */

export interface EmployeeLedgerEntry {
  id: string;
  date: IsoDate;
  kind: "pay" | "advance";
  label: string;
  gross?: number;
  bonus?: number;
  penalty?: number;
  deduction?: number;
  net?: number;
  advance?: number;
  /** رصيد السلف بعد الحركة */
  advanceBalance: number;
}

export function employeeLedger(ds: DemoDataset, employeeId: string): EmployeeLedgerEntry[] {
  const raw: Omit<EmployeeLedgerEntry, "advanceBalance">[] = [];
  for (const a of ds.advances) {
    if (a.employeeId === employeeId) raw.push({ id: a.id, date: a.date, kind: "advance", label: `سلفة — ${a.note}`, advance: a.amount });
  }
  for (const p of ds.payroll) {
    if (p.employeeId !== employeeId) continue;
    raw.push({ id: p.id, date: p.date, kind: "pay", label: p.periodLabel, gross: p.gross, bonus: p.bonus, penalty: p.penalty, deduction: p.advanceDeduction, net: p.net });
  }
  raw.sort((a, b) => (a.date === b.date ? (a.kind === "advance" ? -1 : 1) : a.date < b.date ? -1 : 1));
  let bal = 0;
  return raw.map((e) => {
    bal += (e.advance ?? 0) - (e.deduction ?? 0);
    return { ...e, advanceBalance: Math.round(bal) };
  });
}

/** المصروف على العمالة من كل خزنة (للتأكد إن الأرقام راكبة على الخزن) */
export function workforceCashOut(ds: DemoDataset, wh: WarehouseId): number {
  return ds.cash.filter((t) => t.warehouseId === wh && hitsCashBox(t) && (t.kind === "salary" || t.kind === "advance")).reduce((s, t) => s - t.amount, 0);
}
