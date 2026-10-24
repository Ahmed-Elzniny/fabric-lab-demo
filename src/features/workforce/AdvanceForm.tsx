// src/features/workforce/AdvanceForm.tsx
"use client";

// سلفة جديدة: بتتصرف من خزنة المخزن اللي الموظف شغال فيه، وبتتخصم على أقساط من القبضة.
import { AlertTriangle, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { advanceBalances, cashBoxBalance } from "@/data/selectors";
import { monthlyEquivalent } from "@/data/workforce";
import type { WarehouseId } from "@/data/types";
import { fmtMoney } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";

const WH: Record<WarehouseId, string> = { kerdasa: "كرداسة", mahalla: "المحلة" };

export function AdvanceForm({ employeeId, onDone }: { employeeId?: string; onDone: () => void }) {
  const { ds, giveAdvance, notify, warehouse } = useDemo();
  const staff = ds.employees.filter((e) => warehouse === "all" || e.warehouseId === warehouse);
  const [empId, setEmpId] = useState(employeeId ?? staff[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [installment, setInstallment] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const emp = ds.employees.find((e) => e.id === empId);
  const outstanding = useMemo(() => advanceBalances(ds, "all").find((h) => h.employeeId === empId)?.outstanding ?? 0, [ds, empId]);
  const amt = Number(amount) || 0;
  const inst = Number(installment) || 0;
  const box = emp ? cashBoxBalance(ds, emp.warehouseId) : 0;
  const monthly = emp ? monthlyEquivalent(emp) : 0;
  const totalAfter = outstanding + amt;
  const heavy = emp && totalAfter > monthly * 0.5;
  const payLabel = emp?.payType === "weekly" ? "أسبوعية" : "مرتب";
  const suggestions = emp
    ? [2, 3, 4]
        .map((n) => Math.ceil(amt / n / 50) * 50)
        .filter((v, i, a) => v > 0 && v <= emp.wage && a.indexOf(v) === i)
    : [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      giveAdvance({ employeeId: empId, amount: amt, installment: inst, note });
      notify(`اتصرفت سلفة ${fmtMoney(amt)} لـ ${emp?.name} من خزنة ${emp ? WH[emp.warehouseId] : ""}.`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حصلت مشكلة.");
    }
  };

  return (
    <form className="cash-form" onSubmit={submit}>
      <label className="field">
        <span>الموظف</span>
        <select id="adv-emp" className="text-input" value={empId} onChange={(e) => setEmpId(e.target.value)} disabled={!!employeeId}>
          {staff.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} — {e.jobTitle} · {WH[e.warehouseId]}
            </option>
          ))}
        </select>
      </label>

      {emp && (
        <div className="collect-head">
          <div>
            <span className="t-muted">{emp.payType === "weekly" ? "الأسبوعية" : "المرتب الشهري"}</span>
            <b className="num">{fmtMoney(emp.wage)}</b>
          </div>
          <div>
            <span className="t-muted">سلف مفتوحة عليه</span>
            <b className="num" style={outstanding > 0 ? { color: "var(--warn)" } : undefined}>
              {fmtMoney(outstanding)}
            </b>
          </div>
        </div>
      )}

      <label className="field">
        <span>مبلغ السلفة</span>
        <span className="field__input">
          <input id="adv-amount" type="number" inputMode="decimal" min={0} step={100} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" style={{ width: "100%" }} />
          <em>ج.م</em>
        </span>
      </label>
      <label className="field">
        <span>القسط اللي هيتخصم من كل {payLabel}</span>
        <span className="field__input">
          <input id="adv-installment" type="number" inputMode="decimal" min={0} step={50} value={installment} onChange={(e) => setInstallment(e.target.value)} placeholder="0" style={{ width: "100%" }} />
          <em>ج.م</em>
        </span>
      </label>
      {suggestions.length > 0 && (
        <div className="quick-amounts">
          {suggestions.map((v) => (
            <button key={v} type="button" className="pill-btn pill-btn--ghost num" onClick={() => setInstallment(String(v))}>
              {fmtMoney(v)} · على {Math.ceil(amt / v)} {emp?.payType === "weekly" ? "أسابيع" : "شهور"}
            </button>
          ))}
        </div>
      )}
      <label className="field">
        <span>السبب (اختياري)</span>
        <input id="adv-note" className="text-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً: مصاريف مدارس" />
      </label>

      {emp && amt > 0 && (
        <p className="cash-form__preview num">
          هتتصرف من خزنة {WH[emp.warehouseId]} (فيها {fmtMoney(box)}) · إجمالي السلف عليه هيبقى {fmtMoney(totalAfter)}
          {inst > 0 && ` · هتخلص بعد ${Math.ceil(totalAfter / inst)} ${emp.payType === "weekly" ? "أسبوع" : "شهر"} تقريباً`}
        </p>
      )}
      {heavy && (
        <p className="form-warn">
          <AlertTriangle size={14} aria-hidden="true" />
          السلف هتعدّي نص دخله الشهري — مسموح، بس هتظهر في التنبيهات.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary btn--block" disabled={!(amt > 0 && inst > 0)}>
        <Check size={16} aria-hidden="true" /> اصرف السلفة
      </button>
    </form>
  );
}
