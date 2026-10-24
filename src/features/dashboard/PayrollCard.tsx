// src/features/dashboard/PayrollCard.tsx
"use client";

// العمالة: الأسبوعيات (الخميس) والمرتبات (أول الشهر) والسلف المفتوحة اللي بتتخصم على أقساط.
import { CalendarClock, ChevronLeft, HardHat, HandCoins } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { PayrollSummary } from "@/data/selectors";
import { daysAgoLabel, fmtDayMonth, fmtInt, fmtMoney, fmtMoneyShort, fmtWeekday } from "@/lib/format";
import { diffDays } from "@/lib/dates";

const WH = { kerdasa: "كرداسة", mahalla: "المحلة" } as const;

interface Props {
  summary: PayrollSummary;
  today: string;
  periodLabel: string;
  onOpen: () => void;
}

function inDays(today: string, date: string) {
  const d = diffDays(date, today);
  if (d === 0) return "النهارده";
  if (d === 1) return "بكرة";
  return `بعد ${d} ${d <= 10 ? "أيام" : "يوم"}`;
}

export function PayrollCard({ summary, today, periodLabel, onOpen }: Props) {
  const s = summary;
  return (
    <Card
      className="span-12"
      icon={<HardHat size={17} />}
      title="العمالة والمرتبات"
      subtitle={`${s.headcount} موظف وعامل · ${s.monthlyStaff} بمرتب شهري · ${s.weeklyStaff} بأسبوعية`}
      actions={
        <button type="button" className="link-btn" onClick={onOpen}>
          كشف المرتبات <ChevronLeft size={14} aria-hidden="true" />
        </button>
      }
    >
      <div className="grid" style={{ gap: 18 }}>
        <div className="span-4" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="payroll-top">
            <div className="payday">
              <span className="payday__label">
                <CalendarClock size={14} aria-hidden="true" /> الأسبوعيات · {fmtWeekday(s.nextWeekly.date)}{" "}
                {fmtDayMonth(s.nextWeekly.date)}
              </span>
              <span className="payday__amount num">{fmtMoney(s.nextWeekly.net)}</span>
              <span className="payday__sub num">
                {inDays(today, s.nextWeekly.date)} · {s.nextWeekly.count} عامل
                {s.nextWeekly.deductions > 0 && ` · خصم سلف ${fmtInt(s.nextWeekly.deductions)}`}
              </span>
            </div>
            <div className="payday">
              <span className="payday__label">
                <CalendarClock size={14} aria-hidden="true" /> المرتبات · {fmtDayMonth(s.nextMonthly.date)}
              </span>
              <span className="payday__amount num">{fmtMoney(s.nextMonthly.net)}</span>
              <span className="payday__sub num">
                {inDays(today, s.nextMonthly.date)} · {s.nextMonthly.count} موظف
                {s.nextMonthly.deductions > 0 && ` · خصم سلف ${fmtInt(s.nextMonthly.deductions)}`}
              </span>
            </div>
          </div>
        </div>

        <div className="span-4">
          <div className="payroll-stats" style={{ marginTop: 0 }}>
            <div className="stat">
              <span>التكلفة الشهرية</span>
              <strong className="num">{fmtMoneyShort(s.monthlyCost, false)}</strong>
            </div>
            <div className="stat">
              <span>مرتبات الفترة</span>
              <strong className="num">{fmtMoneyShort(s.paidInPeriod, false)}</strong>
            </div>
            <div className="stat">
              <span>من المبيعات</span>
              <strong className="num">
                {s.costToSalesPct === null ? "—" : `${s.costToSalesPct.toFixed(1)}٪`}
              </strong>
            </div>
            <div className="stat">
              <span>سلف الفترة</span>
              <strong className="num">{fmtMoneyShort(s.advancesInPeriod, false)}</strong>
            </div>
            <div className="stat">
              <span>سلف مفتوحة</span>
              <strong className="num" style={{ color: "var(--warn)" }}>
                {fmtMoneyShort(s.advancesOutstanding, false)}
              </strong>
            </div>
            <div className="stat">
              <span>عليهم سلف</span>
              <strong className="num">{s.advanceHolders.length}</strong>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--fg-3)" }}>المبالغ بالجنيه · الفترة = {periodLabel}. الأسبوعيات بتتقبض الخميس، والمرتبات أول الشهر.</p>
        </div>

        <div className="span-4">
          <p className="subhead" style={{ marginTop: 0 }}>
            <span>
              <HandCoins size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> السلف المفتوحة
            </span>
            <span style={{ fontWeight: 500, color: "var(--fg-3)" }}>بتتخصم من القبضة الجاية</span>
          </p>
          {s.advanceHolders.length === 0 ? (
            <p style={{ color: "var(--fg-3)", fontSize: 13 }}>مفيش سلف مفتوحة.</p>
          ) : (
            <ul className="rows">
              {s.advanceHolders.slice(0, 4).map((h) => {
                const monthly = h.payType === "weekly" ? h.wage * 4.33 : h.wage;
                const pct = Math.min(100, (h.outstanding / monthly) * 100);
                return (
                  <li key={h.employeeId}>
                    <div className="row__main">
                      <div className="row__title">{h.name}</div>
                      <div className="row__sub num">
                        <span>
                          {h.jobTitle} · {WH[h.warehouseId]}
                        </span>
                        <span>آخر سلفة {daysAgoLabel(diffDays(today, h.lastAdvanceOn))}</span>
                      </div>
                      <div className="adv-progress" title={`${Math.round(pct)}٪ من المرتب الشهري`} aria-hidden="true">
                        <span style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="row__value">
                      {fmtMoney(h.outstanding)}
                      <small className="num">قسط {fmtInt(Math.min(h.installment, h.outstanding))}</small>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
