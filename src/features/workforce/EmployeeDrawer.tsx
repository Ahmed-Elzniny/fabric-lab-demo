// src/features/workforce/EmployeeDrawer.tsx
"use client";

// كشف حساب الموظف: كل قبضة (بالإضافي والخصم وقسط السلفة) وكل سلفة، ورصيد السلف بعد كل حركة.
import { HandCoins, HardHat, Phone, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { advanceBalances } from "@/data/selectors";
import { employeeLedger, monthlyEquivalent } from "@/data/workforce";
import type { WarehouseId } from "@/data/types";
import { diffDays } from "@/lib/dates";
import { fmtDayMonth, fmtFullDate, fmtMoney } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";
import { AdvanceForm } from "./AdvanceForm";

const WH: Record<WarehouseId, string> = { kerdasa: "كرداسة", mahalla: "المحلة" };

export function EmployeeDrawer() {
  const { ds, openEmployeeId, openEmployee } = useDemo();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const emp = openEmployeeId ? ds.employees.find((e) => e.id === openEmployeeId) : undefined;

  const data = useMemo(() => {
    if (!emp) return null;
    const ledger = employeeLedger(ds, emp.id);
    const h = advanceBalances(ds, "all").find((x) => x.employeeId === emp.id);
    return { ledger: ledger.slice(-24), outstanding: h?.outstanding ?? 0, installment: h?.installment ?? 0 };
  }, [ds, emp]);

  useEffect(() => {
    if (!emp) return;
    setAdvancing(false);
    closeRef.current?.focus();
  }, [emp]);

  useEffect(() => {
    if (!emp || advancing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") openEmployee(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [emp, advancing, openEmployee]);

  if (!emp || !data) return null;
  const monthly = monthlyEquivalent(emp);
  const years = Math.floor(diffDays(ds.today, emp.hiredOn) / 365);

  return (
    <div className="drawer" role="presentation">
      <button type="button" className="drawer__scrim" aria-label="قفل" onClick={() => openEmployee(null)} />
      <aside className="drawer__panel drawer__panel--wide" role="dialog" aria-modal="true" aria-labelledby="emp-title">
        <header className="drawer__head">
          <div className="drawer__title">
            <span className="card__icon" aria-hidden="true">
              <HardHat size={17} />
            </span>
            <div>
              <h2 id="emp-title">{emp.name}</h2>
              <p>
                {emp.jobTitle} · مخزن {WH[emp.warehouseId]} ·{" "}
                <span className="ltr num">
                  <Phone size={11} aria-hidden="true" /> {emp.phone}
                </span>
              </p>
            </div>
          </div>
          <button ref={closeRef} type="button" className="icon-btn" onClick={() => openEmployee(null)} aria-label="قفل">
            <X size={18} />
          </button>
        </header>
        <div className="drawer__body">
          <section className="cust-kpis">
            <div className="cust-kpi cust-kpi--main">
              <span>{emp.payType === "weekly" ? "الأسبوعية (بتتقبض الخميس)" : "المرتب الشهري (أول الشهر)"}</span>
              <strong className="num">{fmtMoney(emp.wage)}</strong>
              <small className="num">≈ {fmtMoney(monthly)} في الشهر</small>
            </div>
            <div className="cust-kpi">
              <span>سلف مفتوحة</span>
              <strong className="num" style={data.outstanding > 0 ? { color: "var(--warn)" } : undefined}>
                {fmtMoney(data.outstanding)}
              </strong>
            </div>
            <div className="cust-kpi">
              <span>القسط</span>
              <strong className="num">{data.outstanding > 0 ? fmtMoney(Math.min(data.installment, data.outstanding)) : "—"}</strong>
            </div>
            <div className="cust-kpi">
              <span>من إمتى معانا</span>
              <strong>{years > 0 ? `${years} سنين` : "أقل من سنة"}</strong>
              <small className="t-muted">{fmtFullDate(emp.hiredOn)}</small>
            </div>
          </section>

          <div className="cust-actions">
            <button type="button" className="btn btn--primary" onClick={() => setAdvancing(true)}>
              <HandCoins size={16} aria-hidden="true" /> سلفة جديدة
            </button>
          </div>

          <section className="statement">
            <header>
              <h3>القبض والسلف</h3>
              <span className="t-muted">آخر {data.ledger.length} حركة</span>
            </header>
            <div className="table-wrap">
              <table className="table statement__table">
                <thead>
                  <tr>
                    <th scope="col">التاريخ</th>
                    <th scope="col">البيان</th>
                    <th scope="col" className="t-num">
                      الأجر
                    </th>
                    <th scope="col" className="t-num">
                      إضافي / خصم
                    </th>
                    <th scope="col" className="t-num">
                      قسط سلفة
                    </th>
                    <th scope="col" className="t-num">
                      اتصرف
                    </th>
                    <th scope="col" className="t-num">
                      رصيد السلف
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.ledger].reverse().map((e) => (
                    <tr key={e.id} className={e.kind === "advance" ? "is-advance" : ""}>
                      <td className="num">{fmtDayMonth(e.date)}</td>
                      <td>{e.label}</td>
                      <td className="t-num">{e.gross ? fmtMoney(e.gross) : ""}</td>
                      <td className="t-num">
                        {e.bonus ? <span className="amt-in">+{fmtMoney(e.bonus)}</span> : null}
                        {e.penalty ? <span className="amt-out"> −{fmtMoney(e.penalty)}</span> : null}
                      </td>
                      <td className="t-num">{e.deduction ? <span className="amt-out">−{fmtMoney(e.deduction)}</span> : ""}</td>
                      <td className="t-num t-strong">{e.kind === "advance" ? fmtMoney(e.advance ?? 0) : fmtMoney(e.net ?? 0)}</td>
                      <td className="t-num">{e.advanceBalance > 0 ? fmtMoney(e.advanceBalance) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </aside>
      {advancing && (
        <Modal title="سلفة جديدة" subtitle={emp.name} icon={<HandCoins size={17} />} onClose={() => setAdvancing(false)}>
          <AdvanceForm employeeId={emp.id} onDone={() => setAdvancing(false)} />
        </Modal>
      )}
    </div>
  );
}
