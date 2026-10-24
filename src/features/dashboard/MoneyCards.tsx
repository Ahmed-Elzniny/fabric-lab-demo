// src/features/dashboard/MoneyCards.tsx
"use client";

// كروت الفلوس: أعلى العملاء مديونية + الخزن.
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, UserRoundCheck, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { CashBoxSummary, Debtor } from "@/data/selectors";
import type { CashKind } from "@/data/types";
import { daysAgoLabel, fmtMoney, fmtMoneyShort } from "@/lib/format";
import type { ChartColors } from "@/lib/useThemeColors";

const initials = (name: string) =>
  name
    .replace(/^(مصنع|ورشة|شركة|معرض|أتيليه)\s+/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.replace(/^ال/, "").charAt(0))
    .join("");

export function DebtorsCard({
  debtors,
  colors,
  onOpen,
  onRow,
}: {
  debtors: Debtor[];
  colors: ChartColors;
  onOpen: () => void;
  onRow: (customerId: string) => void;
}) {
  const max = Math.max(1, ...debtors.map((d) => Math.max(d.balance, d.creditLimit)));
  return (
    <Card
      className="span-4"
      icon={<UserRoundCheck size={17} />}
      title="أعلى العملاء مديونية"
      subtitle="الرصيد مقابل حد الائتمان"
      footer={
        <>
          <span>الخط الرأسي = حد الائتمان</span>
          <button type="button" className="link-btn" onClick={onOpen}>
            كل العملاء <ChevronLeft size={14} aria-hidden="true" />
          </button>
        </>
      }
    >
      <ul className="rows">
        {debtors.map((d) => {
          const over = d.balance > d.creditLimit;
          const late = (d.daysSincePayment ?? 0) > 40;
          return (
            <li key={d.customerId} className="row--click" tabIndex={0} onClick={() => onRow(d.customerId)} onKeyDown={(e) => e.key === "Enter" && onRow(d.customerId)} aria-label={`كشف حساب ${d.name}`}>
              <span className="avatar" aria-hidden="true">
                {initials(d.name)}
              </span>
              <div className="row__main">
                <div className="row__title">{d.name}</div>
                <div className="row__sub">
                  <span>{d.area}</span>
                  {d.daysSincePayment !== null && (
                    <span style={late ? { color: "var(--crit)", fontWeight: 600 } : undefined}>
                      آخر دفعة {daysAgoLabel(d.daysSincePayment)}
                    </span>
                  )}
                </div>
                <div className="bar-track" style={{ position: "relative", marginTop: 6 }} aria-hidden="true">
                  <span
                    className="bar-fill"
                    style={{
                      display: "block",
                      width: `${(d.balance / max) * 100}%`,
                      background: d.warehouseId === "kerdasa" ? colors.kerdasa : colors.mahalla,
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      top: -3,
                      bottom: -3,
                      right: `${(d.creditLimit / max) * 100}%`,
                      width: 2,
                      background: colors.fg,
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>
              <div className="row__value">
                {fmtMoneyShort(d.balance)}
                {over ? (
                  <small style={{ color: "var(--crit)", fontWeight: 600 }}>فوق الحد</small>
                ) : (
                  <small>من {fmtMoneyShort(d.creditLimit, false)}</small>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const KIND_LABEL: Record<CashKind, string> = {
  cash_sale: "بيع نقدي",
  collection: "تحصيل",
  supplier_payment: "دفع لمورد",
  expense: "مصروف",
  cash_transfer_in: "تحويل وارد",
  cash_transfer_out: "تحويل صادر",
  bank_deposit: "إيداع بنك",
  salary: "مرتبات",
  advance: "سلفة",
  adjustment: "تسوية جرد",
};

export function CashBoxesCard({ boxes, periodLabel }: { boxes: CashBoxSummary[]; periodLabel: string }) {
  return (
    <Card className="span-4" icon={<Wallet size={17} />} title="الخزن" subtitle={`كل مخزن بخزنته · الحركة ${periodLabel}`}>
      {boxes.map((b) => (
        <div className="cashbox" key={b.warehouseId}>
          <div className="cashbox__head">
            <span className="cashbox__name">
              <span className={`wh-dot wh-dot--${b.warehouseId}`} aria-hidden="true" />
              خزنة {b.warehouseId === "kerdasa" ? "كرداسة" : "المحلة"}
            </span>
            <span className="cashbox__balance">{fmtMoney(b.balance)}</span>
          </div>
          <div className="cashbox__flows">
            <span className="flow flow--in">
              <ArrowDownLeft size={14} aria-hidden="true" /> وارد <b>{fmtMoneyShort(b.inflow, false)}</b>
            </span>
            <span className="flow flow--out">
              <ArrowUpRight size={14} aria-hidden="true" /> منصرف <b>{fmtMoneyShort(b.outflow, false)}</b>
            </span>
          </div>
          <ul className="cash-tx" aria-label="آخر الحركات">
            {b.recent.map((t) => (
              <li key={t.id}>
                <span title={t.note}>
                  {KIND_LABEL[t.kind]} · {t.note.split(" — ")[1] ?? t.note}
                </span>
                <span className={t.amount >= 0 ? "amt-in" : "amt-out"}>
                  {t.amount >= 0 ? "+" : "−"}
                  {fmtMoneyShort(Math.abs(t.amount), false)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}
