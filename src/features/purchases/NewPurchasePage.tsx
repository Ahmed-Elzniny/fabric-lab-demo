// src/features/purchases/NewPurchasePage.tsx
"use client";

// استلام بضاعة من المصنع: المورد ← الطبخات بأطوال التواب ← الملخص (مصاريف النقل والدفع).
// مصاريف النقل والتحميل بتتوزّع على الطبخات حسب قيمتها، فتكلفة كل متر/كيلو بتبقى حقيقية (Landed Cost).
import { AlertTriangle, ArrowRight, CircleCheckBig, Factory, Layers, List, Lock, Plus, Save, Tag, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { RollIcon } from "@/components/ui/RollIcon";
import { landedCosts, nextLotCode, nextPurchaseNumber, supplierRows } from "@/data/purchases";
import { cashBoxBalance } from "@/data/selectors";
import type { DyeLot, PurchaseInvoice, WarehouseId } from "@/data/types";
import { fmtFullDate, fmtInt, fmtMoney, fmtMoneyShort, fmtQty } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";
import { LotEntry, type LotDraftUI } from "./LotEntry";
import { RollLabels } from "./RollLabels";

const WH: Record<WarehouseId, string> = { kerdasa: "كرداسة", mahalla: "المحلة" };
type PayMode = "credit" | "partial" | "cash";
let keySeq = 0;
const newLot = (): LotDraftUI => ({ key: `l${++keySeq}`, itemId: "", colorId: "", unitCost: "", rolls: [] });

export function NewPurchasePage() {
  const { ds, ix, warehouse, can, createPurchase, notify, setView, setOpenLot, userName } = useDemo();
  const locked: WarehouseId | null = can.seeAllWarehouses ? null : "kerdasa";
  const showCost = can.seeProfit;

  const [wh, setWh] = useState<WarehouseId>(locked ?? (warehouse === "mahalla" ? "mahalla" : "kerdasa"));
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierRef, setSupplierRef] = useState("");
  const [lots, setLots] = useState<LotDraftUI[]>([newLot()]);
  const [extra, setExtra] = useState("");
  const [payMode, setPayMode] = useState<PayMode>("partial");
  const [paidInput, setPaidInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ invoice: PurchaseInvoice } | null>(null);

  const suppliers = useMemo(() => supplierRows(ds), [ds]);
  const firstCode = nextLotCode(ds);

  // للعرض: أمين المخزن مابيشوفش الأسعار — بنحسب بالتكلفة الافتراضية للصنف
  const inputs = lots.map((l) => {
    const item = ix.itemById.get(l.itemId);
    return { itemId: l.itemId, colorId: l.colorId, unitCost: showCost ? Number(l.unitCost) || 0 : item?.baseCost ?? 0, rolls: l.rolls };
  });
  const extraNum = Math.max(0, Number(extra) || 0);
  const landed = landedCosts(inputs, extraNum);
  const value = landed.reduce((s, l) => s + l.value, 0);
  let meters = 0;
  let kilos = 0;
  let rolls = 0;
  inputs.forEach((l, i) => {
    rolls += l.rolls.length;
    if (ix.itemById.get(l.itemId)?.unit === "kg") kilos += landed[i]!.qty;
    else meters += landed[i]!.qty;
  });
  const paid = !showCost ? 0 : payMode === "cash" ? value : payMode === "credit" ? 0 : Math.min(value, Math.max(0, Number(paidInput) || 0));
  const box = cashBoxBalance(ds, wh);
  const cashOut = paid + (showCost ? extraNum : 0);
  const supplier = suppliers.find((s) => s.supplier.id === supplierId);

  const submit = () => {
    setError(null);
    if (!supplierId) return setError("اختار المورد الأول.");
    try {
      const inv = createPurchase({
        warehouseId: wh,
        supplierId,
        supplierRef,
        lots: inputs,
        extraCost: showCost ? extraNum : 0,
        paidNow: paid,
      });
      setCreated({ invoice: inv });
      notify(`اتسجل استلام ${inv.number} — ${rolls} توب دخلوا مخزن ${WH[wh]}.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "حصلت مشكلة.");
    }
  };

  if (created) {
    const inv = ds.purchaseInvoices.find((p) => p.id === created.invoice.id) ?? created.invoice;
    const newLots = inv.lotIds.map((id) => ix.lotById.get(id)).filter((l): l is DyeLot => Boolean(l));
    const lotIds = new Set(inv.lotIds);
    const newRolls = ds.rolls.filter((r) => lotIds.has(r.lotId));
    const supBal = supplierRows(ds).find((s) => s.supplier.id === inv.supplierId);
    return (
      <section className="card success success--wide" aria-live="polite">
        <div className="success__head">
          <span className="success__icon" aria-hidden="true">
            <CircleCheckBig size={30} />
          </span>
          <div>
            <p className="eyebrow">اتسجل الاستلام</p>
            <h2>
              فاتورة شراء <span className="mono">{inv.number}</span>
              {showCost && <> · {fmtMoney(inv.total)}</>}
            </h2>
            <p className="success__sub">
              {supBal?.supplier.name} · مخزن {WH[inv.warehouseId]}
              {inv.supplierRef && ` · فاتورة المورد ${inv.supplierRef}`}
            </p>
          </div>
        </div>
        <ul className="success__effects">
          <li>
            <RollIcon size={18} />
            <span>
              دخل <b className="num">{fmtInt(newRolls.length)} توب</b> في {newLots.length} طبخة جديدة ({newLots.map((l) => l.code).join("، ")}) مخزن {WH[inv.warehouseId]} — ومتاحين للبيع فوراً
            </span>
          </li>
          {showCost && (
            <li>
              <Layers size={18} aria-hidden="true" />
              <span>
                تكلفة كل طبخة اتحسبت شاملة النقل:{" "}
                {newLots.map((l) => (
                  <b key={l.id} className="num" style={{ marginInlineEnd: 8 }}>
                    {l.code}: {fmtMoney(l.unitCost)}/{ix.itemById.get(l.itemId)?.unit === "kg" ? "كجم" : "م"}
                  </b>
                ))}
              </span>
            </li>
          )}
          {showCost && (
            <li>
              <Wallet size={18} aria-hidden="true" />
              <span>
                {inv.paidNow > 0 || inv.extraCost ? (
                  <>
                    خرج من خزنة {WH[inv.warehouseId]} <b className="num">{fmtMoney(inv.paidNow + (inv.extraCost ?? 0))}</b>
                    {inv.extraCost ? ` (منهم ${fmtMoney(inv.extraCost)} نقل وتحميل)` : ""}
                  </>
                ) : (
                  <>مفيش فلوس خرجت — الفاتورة كلها آجل</>
                )}{" "}
                · المستحق للمورد بقى <b className="num">{fmtMoney(supBal?.balance ?? 0)}</b>
              </span>
            </li>
          )}
        </ul>

        <div className="labels-block">
          <h3>
            <Tag size={15} aria-hidden="true" /> ملصقات التواب
          </h3>
          <p className="t-muted">كل توب بياخد ملصق بكوده وطوله — ده اللي بتدوّر بيه في البحث وفي الفاتورة.</p>
          <RollLabels rolls={newRolls} lots={newLots} ix={ix} />
        </div>

        <div className="success__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setCreated(null);
              setLots([newLot()]);
              setExtra("");
              setPaidInput("");
              setSupplierRef("");
            }}
          >
            <Plus size={16} aria-hidden="true" /> استلام جديد
          </button>
          {newLots[0] && (
            <button type="button" className="btn btn--outline" onClick={() => setOpenLot({ lotId: newLots[0]!.id })}>
              <Layers size={16} aria-hidden="true" /> افتح الطبخة {newLots[0].code}
            </button>
          )}
          <button type="button" className="btn btn--outline" onClick={() => setView("purchases")}>
            <List size={16} aria-hidden="true" /> كل المشتريات
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="composer">
      <div className="composer__main">
        <section className="card step">
          <header className="step__head">
            <span className="step__num">1</span>
            <h3>المورد</h3>
          </header>
          <div className="step__body">
            <div className="supplier-grid">
              {suppliers.map((s) => (
                <button key={s.supplier.id} type="button" className="supplier-card" aria-pressed={supplierId === s.supplier.id} onClick={() => setSupplierId(s.supplier.id)}>
                  <span className="supplier-card__name">
                    <Factory size={14} aria-hidden="true" /> {s.supplier.name}
                  </span>
                  <span className="t-muted">{s.supplier.city}</span>
                  {showCost && <span className="supplier-card__bal num">مستحق له {fmtMoneyShort(s.balance)}</span>}
                </button>
              ))}
            </div>
            <label className="field" style={{ maxWidth: 320 }}>
              <span>رقم فاتورة المورد (اختياري)</span>
              <input id="po-ref" className="text-input" dir="auto" value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} placeholder="مثلاً A-1047" />
            </label>
          </div>
        </section>

        <section className="card step">
          <header className="step__head">
            <span className="step__num">2</span>
            <h3>الطبخات والتواب</h3>
            <p>كل لون جاي من المصنع = طبخة لوحدها. كل توب بيتسجل بطوله أو وزنه الفعلي.</p>
          </header>
          <div className="step__body">
            {lots.map((l, i) => (
              <LotEntry
                key={l.key}
                index={i}
                lotCode={firstCode + i}
                draft={l}
                items={ds.items}
                colors={ix.colorById}
                showCost={showCost}
                landedUnitCost={extraNum > 0 && landed[i]!.qty > 0 ? landed[i]!.landedUnitCost : null}
                onChange={(d) => setLots((ls) => ls.map((x) => (x.key === d.key ? d : x)))}
                onRemove={() => setLots((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [newLot()]))}
              />
            ))}
            <button type="button" className="btn btn--outline add-lot" onClick={() => setLots((ls) => [...ls, newLot()])}>
              <Plus size={16} aria-hidden="true" /> طبخة تانية في نفس الفاتورة
            </button>
          </div>
        </section>
      </div>

      <aside className="composer__side">
        <section className="card summary">
          <header className="summary__head">
            <div>
              <span className="t-muted">فاتورة شراء</span>
              <strong className="mono">PO-{nextPurchaseNumber(ds)}</strong>
            </div>
            <span className="t-muted">{fmtFullDate(ds.today)}</span>
          </header>
          <div className="summary__row">
            <span>مخزن الاستلام</span>
            {locked ? (
              <span className="chip chip--kerdasa">
                <Lock size={11} aria-hidden="true" /> كرداسة
              </span>
            ) : (
              <Segmented<WarehouseId>
                label="مخزن الاستلام"
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
            )}
          </div>
          <div className="summary__row">
            <span>المورد</span>
            <b>{supplier?.supplier.name ?? "—"}</b>
          </div>
          <dl className="summary__totals">
            <div>
              <dt>الطبخات</dt>
              <dd className="num">{lots.filter((l) => l.rolls.length).length}</dd>
            </div>
            <div>
              <dt>التواب</dt>
              <dd className="num">{fmtInt(rolls)}</dd>
            </div>
            <div>
              <dt>الكمية</dt>
              <dd className="num">
                {meters > 0 && `${fmtQty(Math.round(meters * 10) / 10)} م`}
                {meters > 0 && kilos > 0 && " + "}
                {kilos > 0 && `${fmtQty(Math.round(kilos * 10) / 10)} كجم`}
                {rolls === 0 && "—"}
              </dd>
            </div>
            {showCost && (
              <div>
                <dt>قيمة البضاعة</dt>
                <dd className="num">{fmtMoney(value)}</dd>
              </div>
            )}
            {showCost && (
              <div>
                <dt>
                  <label htmlFor="po-extra">نقل وتحميل</label>
                </dt>
                <dd>
                  <span className="field__input field__input--sm">
                    <input id="po-extra" type="number" inputMode="decimal" min={0} step={100} placeholder="0" value={extra} onChange={(e) => setExtra(e.target.value)} />
                    <em>ج.م</em>
                  </span>
                </dd>
              </div>
            )}
          </dl>

          {showCost ? (
            <>
              <div className="summary__net">
                <span>المستحق للمورد</span>
                <strong className="num">{fmtMoney(value)}</strong>
              </div>
              {extraNum > 0 && <p className="summary__profit num">النقل ({fmtMoney(extraNum)}) اتوزّع على تكلفة الطبخات ومش بيتضاف على المورد</p>}
              <div className="summary__pay">
                <span className="summary__label">الدفع للمورد</span>
                <Segmented<PayMode>
                  label="الدفع"
                  size="sm"
                  value={payMode}
                  onChange={setPayMode}
                  options={[
                    { value: "credit", label: "آجل" },
                    { value: "partial", label: "دفعة" },
                    { value: "cash", label: "كامل" },
                  ]}
                />
                {payMode === "partial" && (
                  <label className="field">
                    <span>الدفعة دلوقتي</span>
                    <span className="field__input">
                      <input id="po-paid" type="number" inputMode="decimal" min={0} step={1000} placeholder="0" value={paidInput} onChange={(e) => setPaidInput(e.target.value)} />
                      <em>ج.م</em>
                    </span>
                  </label>
                )}
                <div className="summary__split num">
                  <span>
                    خارج من خزنة {WH[wh]}: <b className={cashOut > box ? "amt-out" : ""}>{fmtMoney(cashOut)}</b> <small className="t-muted">(فيها {fmtMoneyShort(box)})</small>
                  </span>
                  <span>
                    المستحق للمورد بعد الفاتورة: <b>{fmtMoney((supplier?.balance ?? 0) + value - paid)}</b>
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="locked-note">
              <Lock size={14} aria-hidden="true" /> الأسعار والدفع للمورد بيكملها المالك — إنت بتسجل الكميات والأطوال بس.
            </p>
          )}

          {error && (
            <p className="form-error" role="alert">
              <AlertTriangle size={14} aria-hidden="true" />
              {error}
            </p>
          )}
          <button type="button" className="btn btn--primary btn--block" onClick={submit} disabled={rolls === 0 || !supplierId}>
            <Save size={16} aria-hidden="true" /> تسجيل الاستلام
          </button>
          <p className="summary__note">
            التواب هتدخل مخزون {WH[wh]} فوراً بأكواد جديدة، ومتاحة للبيع والتحويل. المسجّل: {userName}.
          </p>
          <button type="button" className="link-btn" onClick={() => setView("purchases")}>
            <ArrowRight size={14} aria-hidden="true" /> رجوع للمشتريات
          </button>
        </section>
      </aside>
    </div>
  );
}
