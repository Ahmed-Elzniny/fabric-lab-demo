// src/features/cash/CashPage.tsx
"use client";

// الخزن: يومية كل خزنة (رصيد أول اليوم ← الحركات بالرصيد المتراكم ← رصيد آخر اليوم)،
// وتسجيل مصروف، وتقفيل اليومية بالعدّ الفعلي.
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Check, ClipboardCheck, Lock, Receipt, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { dayJournal, EXPENSE_CATEGORIES, recentWorkDays } from "@/data/cashbook";
import { CASH_KIND_LABEL } from "@/data/reports";
import { cashBoxBalance } from "@/data/selectors";
import type { WarehouseId } from "@/data/types";
import { fmtDayMonth, fmtFullDate, fmtMoney, fmtMoneyShort, fmtWeekday } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";

const WH: Record<WarehouseId, string> = { kerdasa: "كرداسة", mahalla: "المحلة" };

function ExpenseForm({ wh, onDone }: { wh: WarehouseId; onDone: () => void }) {
  const { addExpense, notify } = useDemo();
  const [cat, setCat] = useState(EXPENSE_CATEGORIES[0]!);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const amt = Number(amount) || 0;
  return (
    <form
      className="cash-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        try {
          addExpense({ warehouseId: wh, amount: amt, category: cat, note });
          notify(`اتسجل مصروف ${fmtMoney(amt)} (${cat}) من خزنة ${WH[wh]}.`);
          onDone();
        } catch (err) {
          setError(err instanceof Error ? err.message : "حصلت مشكلة.");
        }
      }}
    >
      <div className="field">
        <span>البند</span>
        <div className="color-pick">
          {EXPENSE_CATEGORIES.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={cat === c} className="color-pick__btn" onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>المبلغ</span>
        <span className="field__input">
          <input id="exp-amount" type="number" inputMode="decimal" min={0} step={50} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" style={{ width: "100%" }} />
          <em>ج.م</em>
        </span>
      </label>
      <label className="field">
        <span>تفاصيل (اختياري)</span>
        <input id="exp-note" className="text-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً: نقل 20 توب لمصنع النور" />
      </label>
      {error && (
        <p className="form-error" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary btn--block" disabled={!(amt > 0)}>
        <Check size={16} aria-hidden="true" /> سجّل المصروف
      </button>
    </form>
  );
}

function ClosingForm({ wh, expected, onDone }: { wh: WarehouseId; expected: number; onDone: () => void }) {
  const { closeCashDay, notify } = useDemo();
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const c = Number(counted);
  const has = counted.trim() !== "" && Number.isFinite(c);
  const diff = has ? Math.round((c - expected) * 100) / 100 : 0;
  return (
    <form
      className="cash-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        try {
          const r = closeCashDay({ warehouseId: wh, counted: c, note });
          notify(r.difference === 0 ? `اتقفلت خزنة ${WH[wh]} — مظبوطة.` : `اتقفلت خزنة ${WH[wh]} — ${r.difference < 0 ? "عجز" : "زيادة"} ${fmtMoney(Math.abs(r.difference))}.`);
          onDone();
        } catch (err) {
          setError(err instanceof Error ? err.message : "حصلت مشكلة.");
        }
      }}
    >
      <div className="collect-head">
        <div>
          <span className="t-muted">رصيد السيستم دلوقتي</span>
          <b className="num">{fmtMoney(expected)}</b>
        </div>
        <div>
          <span className="t-muted">خزنة</span>
          <b>{WH[wh]}</b>
        </div>
      </div>
      <label className="field">
        <span>المبلغ اللي اتعدّ فعلاً في الخزنة</span>
        <span className="field__input">
          <input id="close-counted" type="number" inputMode="decimal" min={0} step={1} value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="0" style={{ width: "100%" }} />
          <em>ج.م</em>
        </span>
      </label>
      <button type="button" className="pill-btn pill-btn--ghost" style={{ alignSelf: "flex-start" }} onClick={() => setCounted(String(Math.round(expected)))}>
        مظبوطة — نفس رصيد السيستم
      </button>
      {has && (
        <p className={diff === 0 ? "cash-form__preview" : diff < 0 ? "form-error" : "form-warn"}>
          {diff === 0 ? "الخزنة مظبوطة — مفيش فرق." : diff < 0 ? `عجز ${fmtMoney(Math.abs(diff))} — هيتسجل تسوية باسمك.` : `زيادة ${fmtMoney(diff)} — هتتسجل تسوية باسمك.`}
        </p>
      )}
      <label className="field">
        <span>ملاحظة (اختياري)</span>
        <input id="close-note" className="text-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="سبب العجز أو الزيادة لو فيه" />
      </label>
      {error && (
        <p className="form-error" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary btn--block" disabled={!has}>
        <Lock size={16} aria-hidden="true" /> اقفل يومية النهارده
      </button>
    </form>
  );
}

export function CashPage() {
  const { ds, warehouse, can } = useDemo();
  const boxes = (["kerdasa", "mahalla"] as const).filter((w) => can.access(w));
  const [wh, setWh] = useState<WarehouseId>(warehouse !== "all" && can.access(warehouse) ? warehouse : boxes[0]!);
  const days = useMemo(() => recentWorkDays(ds.today, 10), [ds.today]);
  const [date, setDate] = useState(ds.today);
  const [modal, setModal] = useState<"expense" | "close" | null>(null);
  const j = useMemo(() => dayJournal(ds, wh, date), [ds, wh, date]);
  const isToday = date === ds.today;

  return (
    <>
      <section className="cash-boxes">
        {boxes.map((w) => {
          const today = dayJournal(ds, w, ds.today);
          return (
            <button key={w} type="button" className={`card cash-box ${w === wh ? "is-active" : ""}`} aria-pressed={w === wh} onClick={() => setWh(w)}>
              <span className="cash-box__name">
                <span className={`wh-dot wh-dot--${w}`} aria-hidden="true" /> خزنة {WH[w]}
                {today.closingRecord ? <span className="chip chip--good">اتقفلت النهارده</span> : <span className="chip chip--info">مفتوحة</span>}
              </span>
              <strong className="num">{fmtMoney(cashBoxBalance(ds, w))}</strong>
              <span className="cash-box__flows num">
                <span>
                  <ArrowDownLeft size={13} aria-hidden="true" /> النهارده {fmtMoneyShort(today.inflow, false)}
                </span>
                <span>
                  <ArrowUpRight size={13} aria-hidden="true" /> {fmtMoneyShort(today.outflow, false)}
                </span>
                <span>{today.entries.length} حركة</span>
              </span>
            </button>
          );
        })}
      </section>

      <section className="card">
        <header className="card__head">
          <div className="card__title">
            <span className="card__icon" aria-hidden="true">
              <Wallet size={17} />
            </span>
            <div>
              <h3>يومية خزنة {WH[wh]}</h3>
              <p>{fmtFullDate(date)}</p>
            </div>
          </div>
          <div className="toolbar__actions">
            <button type="button" className="btn btn--outline btn--sm" onClick={() => setModal("expense")}>
              <Receipt size={14} aria-hidden="true" /> مصروف جديد
            </button>
            {isToday && !j.closingRecord && (
              <button type="button" className="btn btn--primary btn--sm" onClick={() => setModal("close")}>
                <ClipboardCheck size={14} aria-hidden="true" /> تقفيل اليومية
              </button>
            )}
          </div>
        </header>
        <div className="card__body">
          <div className="day-chips" role="group" aria-label="اليوم">
            {days.map((d) => (
              <button key={d} type="button" className="day-chip" aria-pressed={d === date} onClick={() => setDate(d)}>
                <small>{d === ds.today ? "النهارده" : fmtWeekday(d)}</small>
                <b className="num">{fmtDayMonth(d)}</b>
              </button>
            ))}
          </div>

          <div className="journal-sum">
            <div>
              <span>رصيد أول اليوم</span>
              <b className="num">{fmtMoney(j.opening)}</b>
            </div>
            <div>
              <span>وارد</span>
              <b className="num amt-in">+{fmtMoney(j.inflow)}</b>
            </div>
            <div>
              <span>منصرف</span>
              <b className="num amt-out">−{fmtMoney(j.outflow)}</b>
            </div>
            <div className="journal-sum__close">
              <span>رصيد آخر اليوم</span>
              <b className="num">{fmtMoney(j.closing)}</b>
            </div>
          </div>

          {j.closingRecord && (
            <p className={`closing-note ${j.closingRecord.difference === 0 ? "" : "is-diff"}`}>
              <Lock size={14} aria-hidden="true" /> اتقفلت بواسطة {j.closingRecord.closedBy} — المعدود {fmtMoney(j.closingRecord.counted)}
              {j.closingRecord.difference !== 0 && ` · ${j.closingRecord.difference < 0 ? "عجز" : "زيادة"} ${fmtMoney(Math.abs(j.closingRecord.difference))}`}
              {j.closingRecord.note && ` · ${j.closingRecord.note}`}
            </p>
          )}
          {!isToday && !j.closingRecord && <p className="closing-note">يومية مقفولة — الأيام اللي فاتت للعرض بس.</p>}

          {j.entries.length === 0 ? (
            <p className="t-muted" style={{ padding: "18px 0" }}>
              مفيش حركة في الخزنة اليوم ده.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">النوع</th>
                    <th scope="col">البيان</th>
                    <th scope="col" className="t-num">
                      وارد
                    </th>
                    <th scope="col" className="t-num">
                      منصرف
                    </th>
                    <th scope="col" className="t-num">
                      الرصيد
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {j.entries.map(({ tx, balance }) => (
                    <tr key={tx.id}>
                      <td>
                        <span className={`chip ${tx.amount >= 0 ? "chip--good" : "chip--flat"}`}>{CASH_KIND_LABEL[tx.kind]}</span>
                      </td>
                      <td>
                        {tx.note}
                        {tx.createdBy && <span className="t-muted"> · {tx.createdBy}</span>}
                      </td>
                      <td className="t-num amt-in">{tx.amount > 0 ? fmtMoney(tx.amount) : ""}</td>
                      <td className="t-num amt-out">{tx.amount < 0 ? fmtMoney(-tx.amount) : ""}</td>
                      <td className="t-num t-strong">{fmtMoney(balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {modal === "expense" && (
        <Modal title="مصروف جديد" subtitle={`من خزنة ${WH[wh]}`} icon={<Receipt size={17} />} onClose={() => setModal(null)}>
          <ExpenseForm wh={wh} onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal === "close" && (
        <Modal title="تقفيل يومية الخزنة" subtitle="اعدّ الفلوس اللي في الخزنة واكتب المبلغ" icon={<ClipboardCheck size={17} />} onClose={() => setModal(null)}>
          <ClosingForm wh={wh} expected={dayJournal(ds, wh, ds.today).closing} onDone={() => setModal(null)} />
        </Modal>
      )}
    </>
  );
}
