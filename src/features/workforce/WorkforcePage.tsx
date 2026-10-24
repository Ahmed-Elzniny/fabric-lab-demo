// src/features/workforce/WorkforcePage.tsx
"use client";

// العمالة والمرتبات: الموظفين والعمال، وصرف القبضة، والسلف.
import { CalendarClock, HandCoins, Plus, UsersRound, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { advanceBalances, payrollSummary } from "@/data/selectors";
import { employeeRows, monthlyEquivalent } from "@/data/workforce";
import type { WarehouseId } from "@/data/types";
import { diffDays } from "@/lib/dates";
import { daysAgoLabel, fmtDayMonth, fmtInt, fmtMoney, fmtMoneyShort } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";
import { AdvanceForm } from "./AdvanceForm";
import { PayrollRun } from "./PayrollRun";

const WH: Record<WarehouseId, string> = { kerdasa: "كرداسة", mahalla: "المحلة" };
type Tab = "staff" | "payroll" | "advances";

export function WorkforcePage() {
  const { ds, warehouse, period, openEmployee } = useDemo();
  const [tab, setTab] = useState<Tab>("staff");
  const [advanceFor, setAdvanceFor] = useState<string | null | undefined>(undefined);

  const rows = useMemo(() => employeeRows(ds, warehouse), [ds, warehouse]);
  const summary = useMemo(() => payrollSummary(ds, warehouse, period), [ds, warehouse, period]);
  const holders = useMemo(() => advanceBalances(ds, warehouse), [ds, warehouse]);
  const recentAdvances = useMemo(
    () =>
      ds.advances
        .filter((a) => (warehouse === "all" || a.warehouseId === warehouse) && diffDays(ds.today, a.date) <= 60)
        .slice()
        .reverse(),
    [ds, warehouse],
  );

  return (
    <>
      <section className="card toolbar" aria-label="أدوات العمالة">
        <Segmented<Tab>
          label="القسم"
          value={tab}
          onChange={setTab}
          options={[
            {
              value: "staff",
              label: (
                <>
                  <UsersRound size={14} aria-hidden="true" /> الموظفين والعمال
                </>
              ),
            },
            {
              value: "payroll",
              label: (
                <>
                  <Wallet size={14} aria-hidden="true" /> صرف القبضة
                </>
              ),
            },
            {
              value: "advances",
              label: (
                <>
                  <HandCoins size={14} aria-hidden="true" /> السلف ({holders.length})
                </>
              ),
            },
          ]}
        />
        <button type="button" className="btn btn--outline toolbar__cta" onClick={() => setAdvanceFor(null)}>
          <Plus size={16} aria-hidden="true" /> سلفة جديدة
        </button>
      </section>

      <section className="stat-strip" aria-label="ملخص العمالة">
        <div className="stat-tile">
          <span>عدد الموظفين والعمال</span>
          <strong className="num">
            {summary.headcount} <small>· {summary.monthlyStaff} شهري · {summary.weeklyStaff} أسبوعي</small>
          </strong>
        </div>
        <div className="stat-tile">
          <span>تكلفة العمالة في الشهر</span>
          <strong className="num">{fmtMoneyShort(summary.monthlyCost)}</strong>
        </div>
        <div className="stat-tile">
          <span>
            <CalendarClock size={12} aria-hidden="true" /> أسبوعيات {fmtDayMonth(summary.nextWeekly.date)}
          </span>
          <strong className="num">{fmtMoney(summary.nextWeekly.net)}</strong>
        </div>
        <div className="stat-tile">
          <span>
            <CalendarClock size={12} aria-hidden="true" /> مرتبات {fmtDayMonth(summary.nextMonthly.date)}
          </span>
          <strong className="num">{fmtMoney(summary.nextMonthly.net)}</strong>
        </div>
        <div className="stat-tile">
          <span>سلف مفتوحة</span>
          <strong className="num" style={summary.advancesOutstanding > 0 ? { color: "var(--warn)" } : undefined}>
            {fmtMoney(summary.advancesOutstanding)}
          </strong>
        </div>
      </section>

      {tab === "staff" && (
        <section className="card">
          <div className="card__body" style={{ paddingTop: 0 }}>
            <div className="table-wrap">
              <table className="table table--click">
                <thead>
                  <tr>
                    <th scope="col">الاسم</th>
                    <th scope="col">المخزن</th>
                    <th scope="col">القبض</th>
                    <th scope="col" className="t-num">
                      الأجر
                    </th>
                    <th scope="col" className="t-num">
                      في الشهر
                    </th>
                    <th scope="col">السلف المفتوحة</th>
                    <th scope="col">آخر قبض</th>
                    <th scope="col">
                      <span className="sr-only">إجراء</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const monthly = monthlyEquivalent(r.employee);
                    const pct = Math.min(100, (r.outstanding / monthly) * 100);
                    return (
                      <tr
                        key={r.employee.id}
                        tabIndex={0}
                        onClick={() => openEmployee(r.employee.id)}
                        onKeyDown={(e) => e.key === "Enter" && openEmployee(r.employee.id)}
                        aria-label={`كشف ${r.employee.name}`}
                      >
                        <td>
                          <div className="t-strong">{r.employee.name}</div>
                          <div className="t-muted">{r.employee.jobTitle}</div>
                        </td>
                        <td>
                          <span className={`chip chip--${r.employee.warehouseId}`}>
                            <span className={`wh-dot wh-dot--${r.employee.warehouseId}`} aria-hidden="true" />
                            {WH[r.employee.warehouseId]}
                          </span>
                        </td>
                        <td>
                          <span className={`chip ${r.employee.payType === "weekly" ? "chip--info" : "chip--flat"}`}>
                            {r.employee.payType === "weekly" ? "أسبوعي · الخميس" : "شهري · أول الشهر"}
                          </span>
                        </td>
                        <td className="t-num t-strong">{fmtMoney(r.employee.wage)}</td>
                        <td className="t-num t-muted">{fmtMoney(monthly)}</td>
                        <td>
                          {r.outstanding > 0 ? (
                            <div className="limit-cell">
                              <span className="num" style={{ color: pct > 50 ? "var(--crit)" : "var(--warn)", fontWeight: 600 }}>
                                {fmtMoney(r.outstanding)} <small className="t-muted">· قسط {fmtInt(Math.min(r.installment, r.outstanding))}</small>
                              </span>
                              <span className="adv-progress" aria-hidden="true">
                                <span style={{ width: `${pct}%`, background: pct > 50 ? "var(--crit)" : "var(--warn)" }} />
                              </span>
                            </div>
                          ) : (
                            <span className="t-muted">—</span>
                          )}
                        </td>
                        <td className="t-muted">{r.lastPaid ? daysAgoLabel(diffDays(ds.today, r.lastPaid)) : "—"}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn--outline btn--sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAdvanceFor(r.employee.id);
                            }}
                          >
                            <HandCoins size={14} aria-hidden="true" /> سلفة
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {tab === "payroll" && <PayrollRun />}

      {tab === "advances" && (
        <div className="grid">
          <section className="card span-7">
            <header className="card__head">
              <div className="card__title">
                <span className="card__icon" aria-hidden="true">
                  <HandCoins size={17} />
                </span>
                <div>
                  <h3>السلف المفتوحة</h3>
                  <p>بتتخصم أقساطها تلقائي من القبضة الجاية</p>
                </div>
              </div>
            </header>
            <div className="card__body">
              {holders.length === 0 ? (
                <p className="t-muted">مفيش سلف مفتوحة.</p>
              ) : (
                <ul className="rows">
                  {holders.map((h) => {
                    const monthly = h.payType === "weekly" ? h.wage * 4.33 : h.wage;
                    const pct = Math.min(100, (h.outstanding / monthly) * 100);
                    const left = Math.ceil(h.outstanding / Math.max(1, Math.min(h.installment, h.wage * 0.5)));
                    return (
                      <li key={h.employeeId} className="row--click" tabIndex={0} onClick={() => openEmployee(h.employeeId)} onKeyDown={(e) => e.key === "Enter" && openEmployee(h.employeeId)}>
                        <div className="row__main">
                          <div className="row__title">{h.name}</div>
                          <div className="row__sub num">
                            <span>
                              {h.jobTitle} · {WH[h.warehouseId]}
                            </span>
                            <span>
                              قسط {fmtInt(Math.min(h.installment, h.outstanding))} · باقي حوالي {left} {h.payType === "weekly" ? "أسبوع" : "شهر"}
                            </span>
                          </div>
                          <div className="adv-progress" aria-hidden="true">
                            <span style={{ width: `${pct}%`, background: pct > 50 ? "var(--crit)" : "var(--warn)" }} />
                          </div>
                        </div>
                        <div className="row__value">
                          {fmtMoney(h.outstanding)}
                          <small className="num">{Math.round(pct)}٪ من دخله الشهري</small>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
          <section className="card span-5">
            <header className="card__head">
              <div className="card__title">
                <span className="card__icon" aria-hidden="true">
                  <CalendarClock size={17} />
                </span>
                <div>
                  <h3>سلف آخر 60 يوم</h3>
                  <p>كل سلفة بتطلع من خزنة مخزن الموظف</p>
                </div>
              </div>
            </header>
            <div className="card__body">
              <ul className="rows">
                {recentAdvances.slice(0, 12).map((a) => {
                  const e = ds.employees.find((x) => x.id === a.employeeId);
                  return (
                    <li key={a.id}>
                      <div className="row__main">
                        <div className="row__title">{e?.name}</div>
                        <div className="row__sub">
                          <span>{a.note}</span>
                          <span>
                            {fmtDayMonth(a.date)} · خزنة {WH[a.warehouseId]}
                          </span>
                        </div>
                      </div>
                      <div className="row__value">
                        {fmtMoney(a.amount)}
                        <small className="num">قسط {fmtInt(a.installment)}</small>
                      </div>
                    </li>
                  );
                })}
                {recentAdvances.length === 0 && <li className="t-muted">مفيش سلف في آخر 60 يوم.</li>}
              </ul>
            </div>
          </section>
        </div>
      )}

      {advanceFor !== undefined && (
        <Modal title="سلفة جديدة" icon={<HandCoins size={17} />} onClose={() => setAdvanceFor(undefined)}>
          <AdvanceForm employeeId={advanceFor ?? undefined} onDone={() => setAdvanceFor(undefined)} />
        </Modal>
      )}
    </>
  );
}
