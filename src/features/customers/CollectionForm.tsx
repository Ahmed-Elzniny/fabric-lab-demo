// src/features/customers/CollectionForm.tsx
"use client";

// تسجيل تحصيل من عميل: نقدي (بيدخل خزنة المخزن) أو تحويل بنكي أو إنستاباي (بيروحوا للبنك).
import { AlertTriangle, Banknote, Building2, Check, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { customerBalances } from "@/data/selectors";
import type { PaymentMethod, WarehouseId } from "@/data/types";
import { fmtMoney } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";

const WH: Record<WarehouseId, string> = { kerdasa: "كرداسة", mahalla: "المحلة" };

export function CollectionForm({ customerId, onDone }: { customerId: string; onDone: () => void }) {
  const { ds, ix, can, recordCollection, notify } = useDemo();
  const customer = ix.customerById.get(customerId)!;
  const balance = useMemo(() => customerBalances(ds).get(customerId)?.balance ?? 0, [ds, customerId]);
  const [wh, setWh] = useState<WarehouseId>(can.access(customer.homeWarehouseId) ? customer.homeWarehouseId : "kerdasa");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const amt = Number(amount) || 0;

  const quick = [
    { label: "الرصيد كله", v: Math.round(balance) },
    { label: "النص", v: Math.round(balance / 2 / 1000) * 1000 },
    { label: "50 ألف", v: 50_000 },
    { label: "20 ألف", v: 20_000 },
  ].filter((q, i, arr) => q.v > 0 && q.v <= Math.round(balance) && arr.findIndex((x) => x.v === q.v) === i);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      recordCollection({ customerId, warehouseId: wh, amount: amt, method, note });
      notify(
        method === "cash"
          ? `اتسجل تحصيل ${fmtMoney(amt)} من ${customer.name} في خزنة ${WH[wh]}.`
          : `اتسجل تحصيل ${fmtMoney(amt)} من ${customer.name} (${method === "bank" ? "تحويل بنكي" : "إنستاباي"}).`,
      );
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حصلت مشكلة.");
    }
  };

  return (
    <form className="cash-form" onSubmit={submit}>
      <div className="collect-head">
        <div>
          <span className="t-muted">العميل</span>
          <b>{customer.name}</b>
        </div>
        <div>
          <span className="t-muted">الرصيد المستحق</span>
          <b className="num">{fmtMoney(balance)}</b>
        </div>
      </div>

      <div className="field">
        <span>طريقة الدفع</span>
        <Segmented<PaymentMethod>
          label="طريقة الدفع"
          value={method}
          onChange={setMethod}
          options={[
            {
              value: "cash",
              label: (
                <>
                  <Banknote size={14} aria-hidden="true" /> نقدي
                </>
              ),
            },
            {
              value: "instapay",
              label: (
                <>
                  <Smartphone size={14} aria-hidden="true" /> إنستاباي
                </>
              ),
            },
            {
              value: "bank",
              label: (
                <>
                  <Building2 size={14} aria-hidden="true" /> تحويل بنكي
                </>
              ),
            },
          ]}
        />
      </div>

      {method === "cash" && can.seeAllWarehouses && (
        <div className="field">
          <span>الخزنة اللي استلمت</span>
          <Segmented<WarehouseId>
            label="الخزنة"
            size="sm"
            value={wh}
            onChange={setWh}
            options={[
              {
                value: "kerdasa",
                label: (
                  <>
                    <span className="wh-dot wh-dot--kerdasa" aria-hidden="true" /> كرداسة
                  </>
                ),
              },
              {
                value: "mahalla",
                label: (
                  <>
                    <span className="wh-dot wh-dot--mahalla" aria-hidden="true" /> المحلة
                  </>
                ),
              },
            ]}
          />
        </div>
      )}

      <label className="field">
        <span>المبلغ</span>
        <span className="field__input">
          <input
            id="collect-amount"
            type="number"
            inputMode="decimal"
            min={0}
            step={500}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            style={{ width: "100%" }}
          />
          <em>ج.م</em>
        </span>
      </label>
      {quick.length > 0 && (
        <div className="quick-amounts">
          {quick.map((q) => (
            <button key={q.label} type="button" className="pill-btn pill-btn--ghost num" onClick={() => setAmount(String(q.v))}>
              {q.label} · {fmtMoney(q.v)}
            </button>
          ))}
        </div>
      )}
      <label className="field">
        <span>ملاحظة (اختياري)</span>
        <input
          id="collect-note"
          className="text-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={method === "cash" ? "مثلاً: استلمها محمود" : "رقم العملية أو آخر 4 أرقام"}
        />
      </label>

      {amt > 0 && (
        <p className="cash-form__preview num">
          الرصيد بعد التحصيل: <b>{fmtMoney(balance - amt)}</b>
          {method === "cash" ? ` · المبلغ هيدخل خزنة ${WH[wh]}` : " · المبلغ هيتسجل على حساب البنك ومش هيدخل الخزنة"}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary btn--block" disabled={!(amt > 0)}>
        <Check size={16} aria-hidden="true" /> سجّل التحصيل
      </button>
    </form>
  );
}
