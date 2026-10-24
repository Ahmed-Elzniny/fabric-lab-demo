// src/features/purchases/SupplierPaymentForm.tsx
"use client";

// سداد مورد من خزنة مخزن.
import { AlertTriangle, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { supplierRows } from "@/data/purchases";
import { cashBoxBalance } from "@/data/selectors";
import type { WarehouseId } from "@/data/types";
import { fmtMoney } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";

const WH: Record<WarehouseId, string> = { kerdasa: "كرداسة", mahalla: "المحلة" };

export function SupplierPaymentForm({ supplierId, onDone }: { supplierId?: string; onDone: () => void }) {
  const { ds, paySupplier, notify } = useDemo();
  const rows = useMemo(() => supplierRows(ds).filter((r) => r.balance > 0.5), [ds]);
  const [sid, setSid] = useState(supplierId ?? rows[0]?.supplier.id ?? "");
  const [wh, setWh] = useState<WarehouseId>(cashBoxBalance(ds, "kerdasa") >= cashBoxBalance(ds, "mahalla") ? "kerdasa" : "mahalla");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const row = rows.find((r) => r.supplier.id === sid);
  const amt = Number(amount) || 0;
  const box = cashBoxBalance(ds, wh);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      paySupplier({ supplierId: sid, warehouseId: wh, amount: amt, note });
      notify(`اتدفع ${fmtMoney(amt)} لـ ${row?.supplier.name} من خزنة ${WH[wh]}.`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حصلت مشكلة.");
    }
  };

  return (
    <form className="cash-form" onSubmit={submit}>
      <label className="field">
        <span>المورد</span>
        <select id="sp-supplier" className="text-input" value={sid} onChange={(e) => setSid(e.target.value)} disabled={!!supplierId}>
          {rows.map((r) => (
            <option key={r.supplier.id} value={r.supplier.id}>
              {r.supplier.name} — مستحق {Math.round(r.balance).toLocaleString("en-US")} ج.م
            </option>
          ))}
        </select>
      </label>
      <div className="field">
        <span>من خزنة</span>
        <Segmented<WarehouseId>
          label="الخزنة"
          size="sm"
          value={wh}
          onChange={setWh}
          options={(["kerdasa", "mahalla"] as const).map((w) => ({
            value: w,
            label: (
              <>
                <span className={`wh-dot wh-dot--${w}`} aria-hidden="true" /> {WH[w]} · {Math.round(cashBoxBalance(ds, w) / 1000).toLocaleString("en-US")} ألف
              </>
            ),
          }))}
        />
      </div>
      <label className="field">
        <span>المبلغ</span>
        <span className="field__input">
          <input id="sp-amount" type="number" inputMode="decimal" min={0} step={1000} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" style={{ width: "100%" }} />
          <em>ج.م</em>
        </span>
      </label>
      <div className="quick-amounts">
        {[50_000, 100_000, 250_000]
          .filter((v) => row && v <= row.balance && v <= box)
          .map((v) => (
            <button key={v} type="button" className="pill-btn pill-btn--ghost num" onClick={() => setAmount(String(v))}>
              {fmtMoney(v)}
            </button>
          ))}
      </div>
      <label className="field">
        <span>ملاحظة (اختياري)</span>
        <input id="sp-note" className="text-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً: استلمها مندوب المصنع" />
      </label>
      {row && amt > 0 && (
        <p className="cash-form__preview num">
          المستحق للمورد بعد السداد: <b>{fmtMoney(row.balance - amt)}</b> · خزنة {WH[wh]} هتبقى {fmtMoney(box - amt)}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary btn--block" disabled={!(amt > 0) || !sid}>
        <Check size={16} aria-hidden="true" /> سجّل السداد
      </button>
    </form>
  );
}
