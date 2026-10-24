// src/features/transfers/TransferComposer.tsx
"use client";

// إنشاء تحويل بضاعة: المسار والسواق ← الأصناف والألوان ← محتوى التحويل.
// بيتستخدم كشاشة كاملة، وكمان كنافذة "تحويل سريع" من جوه فاتورة البيع.
import { AlertTriangle, ArrowLeftRight, Lock, Send, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { DRIVERS } from "@/data/catalog";
import { assortmentReadiness } from "@/data/selectors";
import { availKey, buildAvailability, defaultLot, draftTotals, type DraftGroup } from "@/data/sales";
import { nextTransferNumber } from "@/data/transfers";
import type { StockTransfer, WarehouseId } from "@/data/types";
import { fmtInt, fmtMoney, fmtQty } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";
import { AssortmentBuilder } from "@/features/sales/AssortmentBuilder";
import { DraftLines } from "@/features/sales/DraftLines";
import { ItemPicker } from "@/features/sales/ItemPicker";

const WH = { kerdasa: "كرداسة", mahalla: "المحلة" } as const;
const opposite = (w: WarehouseId): WarehouseId => (w === "kerdasa" ? "mahalla" : "kerdasa");

export interface TransferIntent {
  from: WarehouseId;
  itemId?: string;
  colorId?: string;
}

interface Props {
  intent?: TransferIntent;
  compact?: boolean;
  onDone: (t: StockTransfer) => void;
  onCancel?: () => void;
}

export function TransferComposer({ intent, compact = false, onDone, onCancel }: Props) {
  const { ds, ix, warehouse, can, createTransfer, userName } = useDemo();
  const lockedFrom: WarehouseId | null = can.seeAllWarehouses ? null : "kerdasa";

  const [from, setFrom] = useState<WarehouseId>(
    lockedFrom ?? intent?.from ?? (warehouse === "kerdasa" ? "kerdasa" : "mahalla"),
  );
  const to = opposite(from);

  // تحويل سريع من الفاتورة: نجهّز اللون الناقص مقدماً (4 تواب من نفس الطبخة أو أقل لو الطبخة أصغر)
  const [groups, setGroups] = useState<DraftGroup[]>(() => {
    if (!intent?.itemId || !intent.colorId) return [];
    const lots = buildAvailability(ds, ix, intent.from).get(availKey(intent.itemId, intent.colorId)) ?? [];
    const lot = defaultLot(lots, 4);
    if (!lot) return [];
    return [
      {
        itemId: intent.itemId,
        unitPrice: 0,
        picks: [{ colorId: intent.colorId, lotId: lot.lot.id, rollIds: lot.rolls.slice(0, Math.min(4, lot.rolls.length)).map((r) => r.id) }],
      },
    ];
  });
  const [activeItemId, setActiveItemId] = useState<string | null>(intent?.itemId ?? null);
  const [driver, setDriver] = useState(DRIVERS[0] ?? "");
  const [note, setNote] = useState(intent?.colorId ? "تكملة لون ناقص لفاتورة بيع" : "");
  const [error, setError] = useState<string | null>(null);

  const availability = useMemo(() => buildAvailability(ds, ix, from), [ds, ix, from]);
  const destAvailability = useMemo(() => buildAvailability(ds, ix, to), [ds, ix, to]);
  const assortment = useMemo(() => assortmentReadiness(ds, ix, from), [ds, ix, from]);
  const totals = draftTotals(groups, 0, ix);
  const activeItem = activeItemId ? ix.itemById.get(activeItemId) : undefined;

  const flip = () => {
    if (lockedFrom) return;
    setFrom(to);
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
    if (groups.length === 0) return setError("اختار تواب للتحويل الأول.");
    try {
      const t = createTransfer({ fromWarehouseId: from, toWarehouseId: to, groups, driver, note });
      onDone(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حصلت مشكلة في الحفظ.");
    }
  };

  return (
    <div className={`composer ${compact ? "composer--compact" : ""}`}>
      <div className="composer__main">
        <section className="card step">
          <header className="step__head">
            <span className="step__num">1</span>
            <h3>المسار والسواق</h3>
          </header>
          <div className="step__body">
            <div className="route-pick">
              <span className={`route-pick__wh route-pick__wh--${from}`}>
                <small>من</small>
                <b>
                  <span className={`wh-dot wh-dot--${from}`} aria-hidden="true" /> مخزن {WH[from]}
                </b>
              </span>
              <button
                type="button"
                className="route-pick__swap"
                onClick={flip}
                disabled={!!lockedFrom}
                aria-label="اعكس اتجاه التحويل"
                title={lockedFrom ? "مسموح لك تبعت من كرداسة بس" : "اعكس الاتجاه"}
              >
                {lockedFrom ? <Lock size={16} /> : <ArrowLeftRight size={18} />}
              </button>
              <span className={`route-pick__wh route-pick__wh--${to}`}>
                <small>إلى</small>
                <b>
                  <span className={`wh-dot wh-dot--${to}`} aria-hidden="true" /> مخزن {WH[to]}
                </b>
              </span>
            </div>
            <div className="field-row">
              <label className="field field--grow">
                <span>السواق أو شركة الشحن</span>
                <input
                  id="transfer-driver"
                  className="text-input"
                  list="drivers-list"
                  value={driver}
                  onChange={(e) => setDriver(e.target.value)}
                  placeholder="مثلاً: عم رمضان"
                />
                <datalist id="drivers-list">
                  {DRIVERS.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </label>
              <label className="field field--grow">
                <span>ملاحظة (اختياري)</span>
                <input id="transfer-note" className="text-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="سبب التحويل" />
              </label>
            </div>
          </div>
        </section>

        <section className="card step">
          <header className="step__head">
            <span className="step__num">2</span>
            <h3>الأصناف والألوان</h3>
            <p>من مخزون {WH[from]} — وجنب كل لون الموجود منه في {WH[to]}</p>
          </header>
          <div className="step__body">
            <ItemPicker
              rows={assortment}
              items={ix.itemById}
              activeId={activeItemId}
              inInvoice={new Set(groups.map((g) => g.itemId))}
              onPick={(id) => setActiveItemId(id === activeItemId ? null : id)}
              addedLabel="في التحويل"
            />
            {activeItem && (
              <AssortmentBuilder
                key={`${activeItem.id}-${from}`}
                mode="transfer"
                item={activeItem}
                colors={ix.colorById}
                availability={availability}
                otherAvailability={destAvailability}
                otherWarehouse={to}
                initial={groups.find((g) => g.itemId === activeItem.id)}
                canSeeCost={can.seeProfit}
                onSave={saveGroup}
                onCancel={() => setActiveItemId(null)}
              />
            )}
          </div>
        </section>

        <section className="card step">
          <header className="step__head">
            <span className="step__num">3</span>
            <h3>محتوى التحويل</h3>
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
              showMoney={false}
              emptyText="لسه مفيش تواب. اختار صنف وحدد الألوان وعدد التواب اللي هتتنقل."
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
              <span className="t-muted">تحويل رقم</span>
              <strong className="mono">TR-{nextTransferNumber(ds)}</strong>
            </div>
            <span className="chip chip--warn">
              <Truck size={12} aria-hidden="true" /> هيبقى في الطريق
            </span>
          </header>
          <div className="summary__row">
            <span>المسار</span>
            <b>
              {WH[from]} ← {WH[to]}
            </b>
          </div>
          <div className="summary__row">
            <span>السواق</span>
            <b>{driver || "—"}</b>
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
            {can.seeProfit && (
              <div>
                <dt>القيمة بالتكلفة</dt>
                <dd className="num">{fmtMoney(totals.cost)}</dd>
              </div>
            )}
          </dl>
          {error && (
            <p className="form-error" role="alert">
              <AlertTriangle size={14} aria-hidden="true" />
              {error}
            </p>
          )}
          <button type="button" className="btn btn--primary btn--block" onClick={submit} disabled={totals.rolls === 0}>
            <Send size={16} aria-hidden="true" /> إرسال التحويل
          </button>
          <p className="summary__note">
            التواب هتخرج من مخزون {WH[from]} فوراً وتبان «في الطريق»، وتدخل مخزون {WH[to]} لما أمين المخزن هناك يأكد الاستلام. المسجّل: {userName}.
          </p>
          {onCancel && (
            <button type="button" className="link-btn" onClick={onCancel}>
              إلغاء
            </button>
          )}
        </section>
      </aside>
    </div>
  );
}
