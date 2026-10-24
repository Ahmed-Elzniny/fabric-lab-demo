// src/features/transfers/CashTransferForm.tsx
"use client";

// تحويل نقدية بين خزنة كرداسة وخزنة المحلة (للمالك بس).
import { AlertTriangle, ArrowLeftRight, Send } from "lucide-react";
import { useState } from "react";
import { cashBoxBalance } from "@/data/selectors";
import type { WarehouseId } from "@/data/types";
import { fmtMoney } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";

const WH = { kerdasa: "كرداسة", mahalla: "المحلة" } as const;

export function CashTransferForm({ onDone }: { onDone: () => void }) {
  const { ds, transferCash, notify } = useDemo();
  const [from, setFrom] = useState<WarehouseId>(cashBoxBalance(ds, "mahalla") >= cashBoxBalance(ds, "kerdasa") ? "mahalla" : "kerdasa");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const to: WarehouseId = from === "kerdasa" ? "mahalla" : "kerdasa";
  const amt = Number(amount) || 0;
  const fromBal = cashBoxBalance(ds, from);
  const toBal = cashBoxBalance(ds, to);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      transferCash({ fromWarehouseId: from, toWarehouseId: to, amount: amt, note });
      notify(`اتحوّل ${fmtMoney(amt)} من خزنة ${WH[from]} لخزنة ${WH[to]}.`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حصلت مشكلة.");
    }
  };

  return (
    <form className="cash-form" onSubmit={submit}>
      <div className="route-pick">
        <span className={`route-pick__wh route-pick__wh--${from}`}>
          <small>من خزنة</small>
          <b>
            <span className={`wh-dot wh-dot--${from}`} aria-hidden="true" /> {WH[from]}
          </b>
          <small className="num">الرصيد {fmtMoney(fromBal)}</small>
        </span>
        <button type="button" className="route-pick__swap" onClick={() => setFrom(to)} aria-label="اعكس الاتجاه">
          <ArrowLeftRight size={18} />
        </button>
        <span className={`route-pick__wh route-pick__wh--${to}`}>
          <small>إلى خزنة</small>
          <b>
            <span className={`wh-dot wh-dot--${to}`} aria-hidden="true" /> {WH[to]}
          </b>
          <small className="num">الرصيد {fmtMoney(toBal)}</small>
        </span>
      </div>

      <label className="field">
        <span>المبلغ</span>
        <span className="field__input">
          <input
            id="cash-amount"
            type="number"
            inputMode="decimal"
            min={0}
            step={1000}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            style={{ width: "100%" }}
          />
          <em>ج.م</em>
        </span>
      </label>
      <div className="quick-amounts">
        {[25_000, 50_000, 100_000].map((v) => (
          <button key={v} type="button" className="pill-btn pill-btn--ghost num" onClick={() => setAmount(String(v))} disabled={v > fromBal}>
            {fmtMoney(v)}
          </button>
        ))}
      </div>
      <label className="field">
        <span>ملاحظة (اختياري)</span>
        <input id="cash-note" className="text-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً: سداد مورد من المحلة" />
      </label>

      {amt > 0 && (
        <p className="cash-form__preview num">
          بعد التحويل: خزنة {WH[from]} {fmtMoney(fromBal - amt)} · خزنة {WH[to]} {fmtMoney(toBal + amt)}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary btn--block" disabled={!(amt > 0)}>
        <Send size={16} aria-hidden="true" /> حوّل النقدية
      </button>
    </form>
  );
}
