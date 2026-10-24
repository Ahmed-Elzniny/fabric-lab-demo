// src/features/sales/AssortmentBuilder.tsx
"use client";

// قلب فاتورة القماش: اختيار الألوان.
// العميل ممكن ياخد كل الألوان أو بعضها بس (مثلاً 3 من 10) — الضغط على اللون بيضيفه أو يشيله.
// لكل لون: الطبخة (افتراضياً الأقدم اللي فيها العدد المطلوب)، وعدد التواب، والتواب نفسها بأطوالها الفعلية.
// مينفعش لون واحد يطلع من طبختين — لو العدد أكبر من الطبخة، النظام بيدوّر على طبخة تانية فيها العدد كامل.
import { ArrowLeftRight, ChevronDown, Eraser, Layers, PackageCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Stepper } from "@/components/ui/Stepper";
import { availKey, countAvailable, defaultLot, type AvailabilityIndex, type DraftGroup, type LotStock } from "@/data/sales";
import type { Item, WarehouseId } from "@/data/types";
import { fmtInt, fmtMoney, fmtQty } from "@/lib/format";

interface Props {
  item: Item;
  colors: Map<string, { name: string; hex: string }>;
  availability: AvailabilityIndex;
  otherAvailability: AvailabilityIndex;
  otherWarehouse: WarehouseId;
  initial?: DraftGroup;
  canSeeCost: boolean;
  onSave: (group: DraftGroup) => void;
  onCancel: () => void;
  /** sale = فاتورة بيع (بسعر)، transfer = تحويل بين المخازن (من غير سعر) */
  mode?: "sale" | "transfer";
  /** في الفاتورة: لون خلصان ومتاح في المخزن التاني ← اعمل تحويل سريع */
  onRequestTransfer?: (colorId: string) => void;
}

interface Pick {
  lotId: string;
  rollIds: string[];
}

const WH = { kerdasa: "كرداسة", mahalla: "المحلة" } as const;

export function AssortmentBuilder({
  item,
  colors,
  availability,
  otherAvailability,
  otherWarehouse,
  initial,
  canSeeCost,
  onSave,
  onCancel,
  mode = "sale",
  onRequestTransfer,
}: Props) {
  const isTransfer = mode === "transfer";
  const unit = item.unit === "kg" ? "كجم" : "م";
  const lotsOf = (colorId: string): LotStock[] => availability.get(availKey(item.id, colorId)) ?? [];

  const [price, setPrice] = useState(String(initial?.unitPrice ?? item.salePrice));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hints, setHints] = useState<Record<string, string>>({});
  const [picks, setPicks] = useState<Record<string, Pick>>(() => {
    const out: Record<string, Pick> = {};
    for (const cid of item.colorIds) {
      const prev = initial?.picks.find((p) => p.colorId === cid);
      out[cid] = prev ? { lotId: prev.lotId, rollIds: [...prev.rollIds] } : { lotId: defaultLot(lotsOf(cid), 1)?.lot.id ?? "", rollIds: [] };
    }
    return out;
  });

  const setCount = (colorId: string, n: number) => {
    const lots = lotsOf(colorId);
    const cur = picks[colorId];
    if (!cur) return;
    let lot = lots.find((l) => l.lot.id === cur.lotId) ?? lots[0];
    if (!lot) return;
    let hint = "";
    if (n > lot.rolls.length) {
      const better = lots.find((l) => l.rolls.length >= n);
      if (better) {
        if (better.lot.id !== lot.lot.id) hint = `اتنقلنا لطبخة ${better.lot.code} عشان فيها ${n} توب من نفس الدرجة`;
        lot = better;
      } else {
        const max = Math.max(...lots.map((l) => l.rolls.length));
        lot = lots.find((l) => l.rolls.length === max) ?? lot;
        hint = `أكبر طبخة فيها ${max} توب بس — مينفعش نخلط طبختين في نفس اللون`;
        n = max;
      }
    }
    const keep = lot.lot.id === cur.lotId ? cur.rollIds.filter((id) => lot!.rolls.some((r) => r.id === id)).slice(0, n) : [];
    const fill = lot.rolls.filter((r) => !keep.includes(r.id)).slice(0, n - keep.length).map((r) => r.id);
    setPicks((p) => ({ ...p, [colorId]: { lotId: lot!.lot.id, rollIds: [...keep, ...fill] } }));
    setHints((h) => ({ ...h, [colorId]: hint }));
  };

  const setLot = (colorId: string, lotId: string) => {
    const lot = lotsOf(colorId).find((l) => l.lot.id === lotId);
    if (!lot) return;
    const n = Math.min(picks[colorId]?.rollIds.length ?? 0, lot.rolls.length);
    setPicks((p) => ({ ...p, [colorId]: { lotId, rollIds: lot.rolls.slice(0, n).map((r) => r.id) } }));
    setHints((h) => ({ ...h, [colorId]: "" }));
  };

  const toggleRoll = (colorId: string, rollId: string) => {
    setPicks((p) => {
      const cur = p[colorId];
      if (!cur) return p;
      const has = cur.rollIds.includes(rollId);
      return { ...p, [colorId]: { ...cur, rollIds: has ? cur.rollIds.filter((x) => x !== rollId) : [...cur.rollIds, rollId] } };
    });
  };

  const fillAll = (n: number) => {
    for (const cid of item.colorIds) if (lotsOf(cid).length > 0) setCount(cid, n);
  };

  const clearAll = () => {
    setPicks((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { ...v, rollIds: [] }])));
    setHints({});
  };

  const rollQty = useMemo(() => {
    const m = new Map<string, number>();
    for (const cid of item.colorIds) for (const l of availability.get(availKey(item.id, cid)) ?? []) for (const r of l.rolls) m.set(r.id, r.quantity);
    return m;
  }, [availability, item]);
  const lotCost = useMemo(() => {
    const m = new Map<string, number>();
    for (const cid of item.colorIds) for (const l of availability.get(availKey(item.id, cid)) ?? []) m.set(l.lot.id, l.lot.unitCost);
    return m;
  }, [availability, item]);

  const priceNum = Number(price);
  let rolls = 0;
  let qty = 0;
  let cost = 0;
  let colorsPicked = 0;
  for (const cid of item.colorIds) {
    const p = picks[cid];
    if (!p || p.rollIds.length === 0) continue;
    colorsPicked++;
    rolls += p.rollIds.length;
    const q = p.rollIds.reduce((s, id) => s + (rollQty.get(id) ?? 0), 0);
    qty += q;
    cost += q * (lotCost.get(p.lotId) ?? 0);
  }
  const value = priceNum > 0 ? qty * priceNum : 0;
  const avgCost = qty > 0 ? cost / qty : 0;
  const margin = priceNum > 0 && qty > 0 ? ((priceNum - avgCost) / priceNum) * 100 : null;
  const stockedColors = item.colorIds.filter((cid) => lotsOf(cid).length > 0).length;
  const valid = rolls > 0 && (isTransfer || priceNum > 0);

  const save = () => {
    if (!valid) return;
    onSave({
      itemId: item.id,
      unitPrice: isTransfer ? 0 : Math.round(priceNum * 100) / 100,
      picks: item.colorIds
        .map((cid) => ({ colorId: cid, lotId: picks[cid]?.lotId ?? "", rollIds: picks[cid]?.rollIds ?? [] }))
        .filter((p) => p.rollIds.length > 0),
    });
  };

  return (
    <section className="builder" aria-label={`تشكيلة ${item.name}`}>
      <header className="builder__head">
        <div>
          <h3>
            {isTransfer ? "تحويل" : "تشكيلة"} {item.name}
          </h3>
          <p>
            {isTransfer
              ? `${stockedColors} من ${item.colorIds.length} لون متاح للتحويل · كل لون من طبخة واحدة`
              : `${stockedColors} من ${item.colorIds.length} لون متاح · اختار الألوان اللي العميل عايزها · الحساب بال${item.unit === "kg" ? "كيلو" : "متر"} الفعلي`}
          </p>
        </div>
        <label className="field field--price" hidden={isTransfer}>
          <span>السعر لل{item.unit === "kg" ? "كيلو" : "متر"}</span>
          <span className="field__input">
            <input
              id={`price-${item.id}`}
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <em>ج.م</em>
          </span>
        </label>
      </header>

      <div className="builder__quick">
        <span>{isTransfer ? "دوس على اللون اللي هيتنقل، أو اختيار سريع:" : "دوس على اللون اللي العميل عايزه، أو اختيار سريع:"}</span>
        {[1, 2, 3].map((n) => (
          <button key={n} type="button" className="pill-btn" onClick={() => fillAll(n)}>
            <Layers size={14} aria-hidden="true" />
            {n === 1 ? "توب من كل لون" : `${n} توب من كل لون`}
          </button>
        ))}
        <button type="button" className="pill-btn pill-btn--ghost" onClick={clearAll} disabled={rolls === 0}>
          <Eraser size={14} aria-hidden="true" /> مسح
        </button>
      </div>

      <div className="ab-rows">
        {item.colorIds.map((cid) => {
          const color = colors.get(cid);
          const lots = lotsOf(cid);
          const pick = picks[cid];
          const stock = lots.reduce((s, l) => s + l.rolls.length, 0);
          if (lots.length === 0 || !pick) {
            const other = countAvailable(otherAvailability, item.id, cid);
            return (
              <div key={cid} className="ab-row ab-row--out">
                <span className="color-tag">
                  <span className="color-tag__chip color-tag__chip--out" aria-hidden="true" />
                  {color?.name}
                </span>
                <span className="ab-row__out">
                  خلص في المخزن ده
                  {other > 0 && !isTransfer && onRequestTransfer && (
                    <button type="button" className="chip chip--info chip--btn num" onClick={() => onRequestTransfer(cid)}>
                      <ArrowLeftRight size={11} aria-hidden="true" />
                      متاح {other} توب في {WH[otherWarehouse]} — اعمل تحويل
                    </button>
                  )}
                  {other > 0 && !isTransfer && !onRequestTransfer && (
                    <span className="chip chip--info num">
                      <ArrowLeftRight size={11} aria-hidden="true" />
                      متاح {other} توب في {WH[otherWarehouse]} — اطلب تحويل من المالك
                    </span>
                  )}
                </span>
              </div>
            );
          }
          const lot = lots.find((l) => l.lot.id === pick.lotId) ?? lots[0]!;
          const q = pick.rollIds.reduce((s, id) => s + (rollQty.get(id) ?? 0), 0);
          const isOpen = expanded === cid;
          return (
            <div key={cid} className={`ab-row ${pick.rollIds.length > 0 ? "ab-row--on" : ""}`}>
              <button
                type="button"
                className="color-tag color-tag--btn"
                aria-pressed={pick.rollIds.length > 0}
                onClick={() => setCount(cid, pick.rollIds.length > 0 ? 0 : 1)}
                title={pick.rollIds.length > 0 ? "شيل اللون من الفاتورة" : "ضيف توب من اللون ده"}
              >
                <span className="color-tag__chip" style={{ backgroundColor: color?.hex }} aria-hidden="true" />
                <span>
                  {color?.name}
                  <small className="num">
                    متاح {stock} توب
                    {isTransfer && ` · في ${WH[otherWarehouse]} ${countAvailable(otherAvailability, item.id, cid)}`}
                  </small>
                </span>
              </button>

              <label className="ab-lot">
                <span className="sr-only">طبخة {color?.name}</span>
                <select id={`lot-${item.id}-${cid}`} value={lot.lot.id} onChange={(e) => setLot(cid, e.target.value)}>
                  {lots.map((l) => (
                    <option key={l.lot.id} value={l.lot.id}>
                      طبخة {l.lot.code} · {l.rolls.length} توب
                    </option>
                  ))}
                </select>
              </label>

              <Stepper value={pick.rollIds.length} max={Math.max(...lots.map((l) => l.rolls.length))} onChange={(n) => setCount(cid, n)} label={`تواب ${color?.name ?? ""}`} />

              <span className="ab-row__qty num">{pick.rollIds.length > 0 ? `${fmtQty(q)} ${unit}` : "—"}</span>

              <button
                type="button"
                className="ab-row__more"
                aria-expanded={isOpen}
                onClick={() => setExpanded(isOpen ? null : cid)}
                title="اختيار تواب معيّنة"
              >
                التواب <ChevronDown size={14} aria-hidden="true" />
              </button>

              {hints[cid] && <p className="ab-row__hint">{hints[cid]}</p>}

              {isOpen && (
                <div className="roll-picker" role="group" aria-label={`تواب طبخة ${lot.lot.code}`}>
                  {lot.rolls.map((r) => {
                    const on = pick.rollIds.includes(r.id);
                    return (
                      <button key={r.id} type="button" className="roll-chip" aria-pressed={on} onClick={() => toggleRoll(cid, r.id)}>
                        <span className="ltr">{r.code}</span>
                        <b className="num">
                          {fmtQty(r.quantity)}
                          {unit}
                        </b>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <footer className="builder__foot">
        <div className="builder__sum num">
          <PackageCheck size={16} aria-hidden="true" />
          <span>
            <b>{fmtInt(rolls)}</b> توب · {colorsPicked} لون · {fmtQty(Math.round(qty * 10) / 10)} {unit}
          </span>
          {!isTransfer && <b className="builder__value">{fmtMoney(value)}</b>}
          {isTransfer && canSeeCost && <span>تكلفتها {fmtMoney(cost)}</span>}
          {!isTransfer && canSeeCost && margin !== null && (
            <span className={`chip ${margin < 5 ? "chip--warn" : "chip--good"}`}>هامش {margin.toFixed(1)}٪</span>
          )}
        </div>
        <div className="builder__actions">
          <button type="button" className="btn btn--outline" onClick={onCancel}>
            إلغاء
          </button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={!valid}>
            {initial ? "تحديث البند" : isTransfer ? "أضف للتحويل" : "أضف للفاتورة"}
          </button>
        </div>
      </footer>
    </section>
  );
}
