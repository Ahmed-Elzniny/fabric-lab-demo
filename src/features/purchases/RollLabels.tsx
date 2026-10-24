// src/features/purchases/RollLabels.tsx
// معاينة ملصقات التواب: كود التوب، الصنف، اللون، الطبخة، والطول — مع باركود.
// الباركود هنا رسم توضيحي؛ في النسخة الحقيقية بيتولّد Code128 ويتطبع على طابعة ملصقات حرارية.
import type { DyeLot, Roll } from "@/data/types";
import type { Indexes } from "@/data/selectors";
import { fmtQty } from "@/lib/format";

function Bars({ code }: { code: string }) {
  // نمط ثابت من الأرقام: كل رقم = 3 أعمدة بعروض مختلفة
  const widths: number[] = [2, 1, 1];
  for (const ch of code.replace(/\D/g, "")) {
    const d = Number(ch);
    widths.push(1 + (d % 3), 1 + ((d + 1) % 2), 1 + ((d * 7) % 3));
  }
  widths.push(1, 1, 2);
  let x = 0;
  const rects = widths.map((w, i) => {
    const r = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={26} fill="currentColor" /> : null;
    x += w;
    return r;
  });
  return (
    <svg className="label__bars" viewBox={`0 0 ${x} 26`} preserveAspectRatio="none" aria-hidden="true">
      {rects}
    </svg>
  );
}

export function RollLabels({ rolls, lots, ix, limit = 12 }: { rolls: Roll[]; lots: DyeLot[]; ix: Indexes; limit?: number }) {
  const lotById = new Map(lots.map((l) => [l.id, l]));
  return (
    <div className="labels">
      {rolls.slice(0, limit).map((r) => {
        const lot = lotById.get(r.lotId);
        const item = ix.itemById.get(r.itemId);
        const color = ix.colorById.get(r.colorId);
        return (
          <div key={r.id} className="label">
            <div className="label__top">
              <b>{item?.name}</b>
              <span>{color?.name}</span>
            </div>
            <Bars code={r.code} />
            <div className="label__code ltr">{r.code}</div>
            <div className="label__meta num">
              <span>طبخة {lot?.code}</span>
              <b>
                {fmtQty(r.quantity)} {item?.unit === "kg" ? "كجم" : "م"}
              </b>
            </div>
          </div>
        );
      })}
      {rolls.length > limit && <div className="label label--more num">+{rolls.length - limit} ملصق كمان</div>}
    </div>
  );
}
