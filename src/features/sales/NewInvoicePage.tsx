// src/features/sales/NewInvoicePage.tsx
"use client";

// فاتورة بيع جديدة: العميل ← الأصناف والألوان ← البنود، والملخص والدفع على الجنب.
import { AlertTriangle, ArrowRight, Lock, Save, Truck } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { TransferComposer, type TransferIntent } from "@/features/transfers/TransferComposer";
import { useEffect, useMemo, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { assortmentReadiness, customerBalances } from "@/data/selectors";
import { buildAvailability, draftTotals, nextInvoiceNumber, type DraftGroup } from "@/data/sales";
import type { SalesInvoice, WarehouseId } from "@/data/types";
import { fmtFullDate, fmtInt, fmtMoney, fmtQty } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";
import { AssortmentBuilder } from "./AssortmentBuilder";
import { CustomerPicker } from "./CustomerPicker";
import { DraftLines } from "./DraftLines";
import { InvoiceSuccess } from "./InvoiceSuccess";
import { ItemPicker } from "./ItemPicker";

type PayMode = "credit" | "partial" | "cash";
const WH = { kerdasa: "كرداسة", mahalla: "المحلة" } as const;

export function NewInvoicePage() {
  const { ds, ix, warehouse, role, can, userName, createInvoice, notify, setView, invoiceCustomerIntent, newInvoiceFor } = useDemo();
  const locked: WarehouseId | null = role === "storekeeper" ? "kerdasa" : null;

  const [wh, setWh] = useState<WarehouseId>(locked ?? (warehouse === "all" ? "kerdasa" : warehouse));
  const [customerId, setCustomerId] = useState<string | null>(invoiceCustomerIntent);
  // العميل جاي متختار من كشف الحساب — نستخدمه مرة واحدة
  useEffect(() => {
    if (invoiceCustomerIntent) newInvoiceFor(null);
  }, [invoiceCustomerIntent, newInvoiceFor]);
  const [groups, setGroups] = useState<DraftGroup[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [discount, setDiscount] = useState("");
  const [payMode, setPayMode] = useState<PayMode>("partial");
  const [paidInput, setPaidInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<SalesInvoice | null>(null);
  const [quickTransfer, setQuickTransfer] = useState<TransferIntent | null>(null);

  // لو المستخدم اتغيّر لأمين مخزن كرداسة، الفاتورة لازم تبقى من كرداسة
  useEffect(() => {
    if (locked && wh !== locked) {
      setWh(locked);
      setGroups([]);
      setActiveItemId(null);
    }
  }, [locked, wh]);

  const other: WarehouseId = wh === "kerdasa" ? "mahalla" : "kerdasa";
  const availability = useMemo(() => buildAvailability(ds, ix, wh), [ds, ix, wh]);
  const otherAvailability = useMemo(() => buildAvailability(ds, ix, other), [ds, ix, other]);
  const assortment = useMemo(() => assortmentReadiness(ds, ix, wh), [ds, ix, wh]);
  const balances = useMemo(() => customerBalances(ds), [ds]);

  const discountNum = Math.max(0, Number(discount) || 0);
  const totals = draftTotals(groups, discountNum, ix);
  const paid =
    payMode === "cash" ? totals.net : payMode === "credit" ? 0 : Math.min(totals.net, Math.max(0, Number(paidInput) || 0));
  const customer = customerId ? ix.customerById.get(customerId) : undefined;
  const balanceNow = customerId ? balances.get(customerId)?.balance ?? 0 : 0;
  const balanceAfter = balanceNow + totals.net - paid;
  const overLimit = !!customer && totals.net > 0 && balanceAfter > customer.creditLimit;
  const blocked = overLimit && !can.exceedCreditLimit;
  const activeItem = activeItemId ? ix.itemById.get(activeItemId) : undefined;
  const invoiceNo = nextInvoiceNumber(ds);

  const changeWarehouse = (w: WarehouseId) => {
    if (w === wh) return;
    if (groups.length > 0) notify(`اتمسحت البنود لأن التواب كانت من مخزن ${WH[wh]}.`);
    setWh(w);
    setGroups([]);
    setActiveItemId(null);
  };

  const saveGroup = (g: DraftGroup) => {
    setGroups((prev) => {
      const i = prev.findIndex((x) => x.itemId === g.itemId);
      if (i === -1) return [...prev, g];
      const copy = [...prev];
      copy[i] = g;
      return copy;
    });
    setActiveItemId(null);
    setError(null);
  };

  const submit = () => {
    setError(null);
    if (!customerId) return setError("اختار العميل الأول.");
    if (groups.length === 0) return setError("ضيف صنف واحد على الأقل.");
    if (blocked) return setError("الفاتورة دي هتعدّي حد ائتمان العميل — محتاجة موافقة المالك.");
    try {
      const inv = createInvoice({ warehouseId: wh, customerId, groups, discount: discountNum, paidNow: paid });
      setCreated(inv);
      notify(`اتسجلت فاتورة ${inv.number}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "حصلت مشكلة في الحفظ.");
    }
  };

  const reset = () => {
    setCreated(null);
    setCustomerId(null);
    setGroups([]);
    setActiveItemId(null);
    setDiscount("");
    setPaidInput("");
    setPayMode("partial");
    setError(null);
  };

  if (created) return <InvoiceSuccess invoice={created} onNew={reset} />;

  return (
    <>
    {quickTransfer && (
      <Modal
        size="lg"
        icon={<Truck size={17} />}
        title={`تحويل سريع من ${WH[quickTransfer.from]} إلى ${WH[wh]}`}
        subtitle="الفاتورة اللي بتعملها هتفضل زي ما هي"
        onClose={() => setQuickTransfer(null)}
      >
        <TransferComposer
          compact
          intent={quickTransfer}
          onCancel={() => setQuickTransfer(null)}
          onDone={(t) => {
            setQuickTransfer(null);
            notify(`اتبعت ${t.number} — التواب هتبقى متاحة في ${WH[t.toWarehouseId]} بعد الاستلام.`);
          }}
        />
      </Modal>
    )}
    <div className="composer">
      <div className="composer__main">
        <section className="card step">
          <header className="step__head">
            <span className="step__num">1</span>
            <h3>العميل</h3>
          </header>
          <div className="step__body">
            <CustomerPicker
              customers={ds.customers}
              balances={balances}
              warehouseId={wh}
              selectedId={customerId}
              onSelect={setCustomerId}
              today={ds.today}
            />
          </div>
        </section>

        <section className="card step">
          <header className="step__head">
            <span className="step__num">2</span>
            <h3>الأصناف والألوان</h3>
            <p>اختار الصنف، وبعدين الألوان اللي العميل عايزها وعدد التواب من كل لون</p>
          </header>
          <div className="step__body">
            <ItemPicker
              rows={assortment}
              items={ix.itemById}
              activeId={activeItemId}
              inInvoice={new Set(groups.map((g) => g.itemId))}
              onPick={(id) => setActiveItemId(id === activeItemId ? null : id)}
            />
            {activeItem && (
              <AssortmentBuilder
                key={`${activeItem.id}-${wh}`}
                item={activeItem}
                colors={ix.colorById}
                availability={availability}
                otherAvailability={otherAvailability}
                otherWarehouse={other}
                initial={groups.find((g) => g.itemId === activeItem.id)}
                canSeeCost={can.seeProfit}
                onSave={saveGroup}
                onCancel={() => setActiveItemId(null)}
                onRequestTransfer={
                  can.access(other) ? (colorId) => setQuickTransfer({ from: other, itemId: activeItem.id, colorId }) : undefined
                }
              />
            )}
          </div>
        </section>

        <section className="card step">
          <header className="step__head">
            <span className="step__num">3</span>
            <h3>بنود الفاتورة</h3>
            {groups.length > 0 && (
              <p className="num">
                {groups.length} صنف · {fmtInt(totals.rolls)} توب
              </p>
            )}
          </header>
          <div className="step__body">
            <DraftLines
              groups={groups}
              ix={ix}
              editingId={activeItemId}
              onEdit={(id) => setActiveItemId(id)}
              onRemove={(id) => {
                setGroups((g) => g.filter((x) => x.itemId !== id));
                if (activeItemId === id) setActiveItemId(null);
              }}
            />
          </div>
        </section>
      </div>

      <aside className="composer__side">
        <section className="card summary">
          <header className="summary__head">
            <div>
              <span className="t-muted">فاتورة رقم</span>
              <strong className="mono">INV-{invoiceNo}</strong>
            </div>
            <span className="t-muted">{fmtFullDate(ds.today)}</span>
          </header>

          <div className="summary__row">
            <span>المخزن</span>
            {locked ? (
              <span className="chip chip--kerdasa">
                <Lock size={11} aria-hidden="true" /> كرداسة
              </span>
            ) : (
              <Segmented<WarehouseId>
                label="مخزن الفاتورة"
                size="sm"
                value={wh}
                onChange={changeWarehouse}
                options={[
                  {
                    value: "kerdasa",
                    label: (
                      <>
                        <span className="wh-dot wh-dot--kerdasa" aria-hidden="true" />
                        كرداسة
                      </>
                    ),
                  },
                  {
                    value: "mahalla",
                    label: (
                      <>
                        <span className="wh-dot wh-dot--mahalla" aria-hidden="true" />
                        المحلة
                      </>
                    ),
                  },
                ]}
              />
            )}
          </div>
          <div className="summary__row">
            <span>العميل</span>
            <b>{customer?.name ?? "—"}</b>
          </div>

          <dl className="summary__totals">
            <div>
              <dt>عدد التواب</dt>
              <dd className="num">{fmtInt(totals.rolls)}</dd>
            </div>
            <div>
              <dt>الكمية</dt>
              <dd className="num">
                {totals.meters > 0 && `${fmtQty(Math.round(totals.meters * 10) / 10)} م`}
                {totals.meters > 0 && totals.kilos > 0 && " + "}
                {totals.kilos > 0 && `${fmtQty(Math.round(totals.kilos * 10) / 10)} كجم`}
                {totals.rolls === 0 && "—"}
              </dd>
            </div>
            <div>
              <dt>إجمالي الأصناف</dt>
              <dd className="num">{fmtMoney(totals.gross)}</dd>
            </div>
            <div>
              <dt>
                <label htmlFor="inv-discount">خصم</label>
              </dt>
              <dd>
                <span className="field__input field__input--sm">
                  <input
                    id="inv-discount"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={50}
                    placeholder="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                  <em>ج.م</em>
                </span>
              </dd>
            </div>
          </dl>

          <div className="summary__net">
            <span>الصافي</span>
            <strong className="num">{fmtMoney(totals.net)}</strong>
          </div>
          {can.seeProfit && totals.net > 0 && (
            <p className="summary__profit num">
              مجمل الربح المتوقع {fmtMoney(totals.net - totals.cost)} ({(((totals.net - totals.cost) / totals.net) * 100).toFixed(1)}٪)
            </p>
          )}

          <div className="summary__pay">
            <span className="summary__label">الدفع</span>
            <Segmented<PayMode>
              label="طريقة الدفع"
              size="sm"
              value={payMode}
              onChange={setPayMode}
              options={[
                { value: "credit", label: "آجل" },
                { value: "partial", label: "جزء نقدي" },
                { value: "cash", label: "نقدي كامل" },
              ]}
            />
            {payMode === "partial" && (
              <label className="field">
                <span>المدفوع نقدي دلوقتي</span>
                <span className="field__input">
                  <input
                    id="inv-paid"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={500}
                    placeholder="0"
                    value={paidInput}
                    onChange={(e) => setPaidInput(e.target.value)}
                  />
                  <em>ج.م</em>
                </span>
              </label>
            )}
            <div className="summary__split num">
              <span>
                نقدي في خزنة {WH[wh]}: <b className="amt-in">{fmtMoney(paid)}</b>
              </span>
              <span>
                على الحساب: <b>{fmtMoney(Math.max(0, totals.net - paid))}</b>
              </span>
            </div>
          </div>

          {customer && totals.net > 0 && (
            <div className={`credit-check ${overLimit ? "credit-check--over" : ""}`}>
              <span>رصيد العميل بعد الفاتورة</span>
              <b className="num">{fmtMoney(balanceAfter)}</b>
              <span className="num">حد الائتمان {fmtMoney(customer.creditLimit)}</span>
              {overLimit && (
                <p>
                  <AlertTriangle size={14} aria-hidden="true" />
                  {can.exceedCreditLimit
                    ? "هيعدّي حد الائتمان — إنت المالك وتقدر تكمّل."
                    : "هيعدّي حد الائتمان — محتاج موافقة المالك أو دفعة نقدي أكبر."}
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="form-error" role="alert">
              <AlertTriangle size={14} aria-hidden="true" />
              {error}
            </p>
          )}

          <button type="button" className="btn btn--primary btn--block" onClick={submit} disabled={blocked}>
            <Save size={16} aria-hidden="true" /> حفظ الفاتورة
          </button>
          <p className="summary__note">
            الحفظ بيخصم التواب من مخزن {WH[wh]}، ويسجّل النقدي في خزنته، ويحدّث رصيد العميل. المسجّل: {userName}.
          </p>
          <button type="button" className="link-btn" onClick={() => setView("sales")}>
            <ArrowRight size={14} aria-hidden="true" /> رجوع لقائمة الفواتير
          </button>
        </section>
      </aside>
    </div>
    </>
  );
}
