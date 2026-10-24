// src/features/workforce/PayrollRun.tsx
"use client";

// صرف القبضة: الأسبوعيات (الخميس) أو المرتبات (أول الشهر).
// قسط السلفة بيتحسب لوحده، وتقدر تعدّله أو تضيف إضافي أو خصم غياب قبل الصرف.
import { AlertTriangle, CalendarCheck, CheckCheck, Copy, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { BUSINESS } from "@/data/catalog";
import { cashBoxBalance } from "@/data/selectors";
import { payrollNet, payrollPreview, weekEnding } from "@/data/workforce";
import type { PayType, PayrollPayment, WarehouseId } from "@/data/types";
import { copyText } from "@/lib/clipboard";
import { fmtDayMonth, fmtMoney, fmtWeekday } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";

const WH: Record<WarehouseId, string> = { kerdasa: "كرداسة", mahalla: "المحلة" };

interface Line {
  include: boolean;
  deduction: string;
  bonus: string;
  penalty: string;
}

export function PayrollRun() {
  const { ds, warehouse, runPayroll, notify } = useDemo();
  const [type, setType] = useState<PayType>("weekly");
  const preview = useMemo(() => payrollPreview(ds, type, warehouse), [ds, type, warehouse]);
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PayrollPayment[] | null>(null);

  // نجهّز السطور كل ما نوع القبضة أو المخزن يتغيّر
  useEffect(() => {
    const next: Record<string, Line> = {};
    for (const r of preview.rows) {
      next[r.employee.id] = { include: !r.alreadyPaid, deduction: r.suggestedDeduction ? String(r.suggestedDeduction) : "", bonus: "", penalty: "" };
    }
    setLines(next);
    setError(null);
    setDone(null);
  }, [type, warehouse]); // eslint-disable-line react-hooks/exhaustive-deps

  const num = (s: string) => Math.max(0, Number(s) || 0);
  const calc = preview.rows.map((r) => {
    const l = lines[r.employee.id] ?? { include: false, deduction: "", bonus: "", penalty: "" };
    const input = { deduction: num(l.deduction), bonus: num(l.bonus), penalty: num(l.penalty) };
    return { r, l, input, net: payrollNet(r.employee.wage, input) };
  });
  const chosen = calc.filter((c) => c.l.include && !c.r.alreadyPaid);
  const byWh: Record<WarehouseId, number> = { kerdasa: 0, mahalla: 0 };
  for (const c of chosen) byWh[c.r.employee.warehouseId] += c.net;
  const total = byWh.kerdasa + byWh.mahalla;
  const deductions = chosen.reduce((s, c) => s + c.input.deduction, 0);
  const allPaid = preview.rows.length > 0 && preview.rows.every((r) => r.alreadyPaid);

  const thursday = weekEnding(ds.today);
  const early = type === "weekly" ? thursday !== ds.today : false;

  const set = (id: string, patch: Partial<Line>) => setLines((ls) => ({ ...ls, [id]: { ...ls[id]!, ...patch } }));

  const pay = () => {
    setError(null);
    try {
      const res = runPayroll(
        type,
        chosen.map((c) => ({ employeeId: c.r.employee.id, ...c.input })),
      );
      setDone(res);
      notify(`اتصرفت ${preview.label} لـ ${res.length} ${type === "weekly" ? "عامل" : "موظف"} — ${fmtMoney(res.reduce((s, p) => s + p.net, 0))}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حصلت مشكلة.");
    }
  };

  const copySheet = async () => {
    const paid = ds.payroll.filter((p) => p.periodLabel === preview.label);
    const txt = [
      `*${BUSINESS.name}* — كشف ${preview.label}`,
      "",
      ...paid.map((p) => {
        const e = ds.employees.find((x) => x.id === p.employeeId);
        const extra = [p.bonus ? `+${p.bonus} إضافي` : "", p.penalty ? `−${p.penalty} خصم` : "", p.advanceDeduction ? `−${p.advanceDeduction} سلفة` : ""].filter(Boolean).join(" ");
        return `${e?.name} (${WH[p.warehouseId]}): ${Math.round(p.net).toLocaleString("en-US")} ج.م${extra ? ` [${extra}]` : ""}`;
      }),
      "",
      `الإجمالي: ${Math.round(paid.reduce((s, p) => s + p.net, 0)).toLocaleString("en-US")} ج.م`,
    ].join("\n");
    const ok = await copyText(txt);
    notify(ok ? "اتنسخ كشف القبضة." : "المتصفح منع النسخ.");
  };

  return (
    <section className="card payrun">
      <header className="payrun__head">
        <Segmented<PayType>
          label="نوع القبضة"
          value={type}
          onChange={setType}
          options={[
            { value: "weekly", label: `أسبوعيات العمال · ${fmtWeekday(thursday)} ${fmtDayMonth(thursday)}` },
            { value: "monthly", label: `مرتبات الموظفين · ${preview.label.replace("مرتب شهر ", "")}` },
          ]}
        />
        <p className="payrun__label">
          <CalendarCheck size={15} aria-hidden="true" /> {preview.label}
          {early && <span className="chip chip--info">صرف مبكر — ميعادها الخميس</span>}
          {allPaid && <span className="chip chip--good">اتصرفت كلها</span>}
        </p>
      </header>

      <div className="table-wrap">
        <table className="table payrun__table">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">صرف</span>
              </th>
              <th scope="col">الاسم</th>
              <th scope="col" className="t-num">
                {type === "weekly" ? "الأسبوعية" : "المرتب"}
              </th>
              <th scope="col">قسط السلفة</th>
              <th scope="col">إضافي</th>
              <th scope="col">خصم غياب</th>
              <th scope="col" className="t-num">
                الصافي
              </th>
            </tr>
          </thead>
          <tbody>
            {calc.map(({ r, l, net }) => {
              const id = r.employee.id;
              const off = r.alreadyPaid || !l.include;
              return (
                <tr key={id} className={off ? "is-off" : ""}>
                  <td>
                    {r.alreadyPaid ? (
                      <span className="chip chip--good">
                        <CheckCheck size={11} aria-hidden="true" /> اتصرفت
                      </span>
                    ) : (
                      <input
                        id={`pay-inc-${id}`}
                        type="checkbox"
                        className="check-lg"
                        checked={l.include}
                        onChange={(e) => set(id, { include: e.target.checked })}
                        aria-label={`صرف ${r.employee.name}`}
                      />
                    )}
                  </td>
                  <td>
                    <div className="t-strong">{r.employee.name}</div>
                    <div className="t-muted">
                      {r.employee.jobTitle} · <span className={`wh-dot wh-dot--${r.employee.warehouseId}`} aria-hidden="true" /> {WH[r.employee.warehouseId]}
                    </div>
                  </td>
                  <td className="t-num">{fmtMoney(r.employee.wage)}</td>
                  <td>
                    {r.outstanding > 0 ? (
                      <div className="pay-input">
                        <input
                          id={`pay-ded-${id}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={r.outstanding}
                          step={50}
                          value={l.deduction}
                          disabled={off}
                          onChange={(e) => set(id, { deduction: e.target.value })}
                          aria-label={`قسط سلفة ${r.employee.name}`}
                        />
                        <small className="num">باقي {fmtMoney(r.outstanding)}</small>
                      </div>
                    ) : (
                      <span className="t-muted">—</span>
                    )}
                  </td>
                  <td>
                    <div className="pay-input">
                      <input
                        id={`pay-bonus-${id}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={50}
                        placeholder="0"
                        value={l.bonus}
                        disabled={off}
                        onChange={(e) => set(id, { bonus: e.target.value })}
                        aria-label={`إضافي ${r.employee.name}`}
                      />
                    </div>
                  </td>
                  <td>
                    <div className="pay-input">
                      <input
                        id={`pay-pen-${id}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={50}
                        placeholder="0"
                        value={l.penalty}
                        disabled={off}
                        onChange={(e) => set(id, { penalty: e.target.value })}
                        aria-label={`خصم غياب ${r.employee.name}`}
                      />
                    </div>
                  </td>
                  <td className="t-num t-strong">{r.alreadyPaid ? "—" : fmtMoney(net)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="payrun__foot">
        <div className="payrun__boxes">
          {(["kerdasa", "mahalla"] as const)
            .filter((w) => byWh[w] > 0)
            .map((w) => {
              const bal = cashBoxBalance(ds, w);
              const short = byWh[w] > bal;
              return (
                <div key={w} className={`payrun__box ${short ? "is-short" : ""}`}>
                  <Wallet size={15} aria-hidden="true" />
                  <span>
                    من خزنة {WH[w]}: <b className="num">{fmtMoney(byWh[w])}</b>
                  </span>
                  <small className="num">الرصيد {fmtMoney(bal)}</small>
                </div>
              );
            })}
        </div>
        <div className="payrun__total">
          <span className="num">
            {chosen.length} {type === "weekly" ? "عامل" : "موظف"}
            {deductions > 0 && ` · أقساط سلف ${fmtMoney(deductions)}`}
          </span>
          <strong className="num">{fmtMoney(total)}</strong>
        </div>
        {error && (
          <p className="form-error" role="alert">
            <AlertTriangle size={14} aria-hidden="true" />
            {error}
          </p>
        )}
        <div className="payrun__actions">
          {(done || preview.rows.some((r) => r.alreadyPaid)) && (
            <button type="button" className="btn btn--outline" onClick={copySheet}>
              <Copy size={16} aria-hidden="true" /> نسخ كشف القبضة
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={pay} disabled={chosen.length === 0}>
            <CheckCheck size={16} aria-hidden="true" /> اصرف {preview.label}
          </button>
        </div>
      </footer>
    </section>
  );
}
