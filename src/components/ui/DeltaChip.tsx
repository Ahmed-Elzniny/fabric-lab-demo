// src/components/ui/DeltaChip.tsx
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { fmtPct } from "@/lib/format";

/** نسبة التغيير مقارنة بالفترة اللي قبلها — شكل السهم + اللون + النص، مش اللون لوحده */
export function DeltaChip({ delta, suffix = "عن الفترة السابقة" }: { delta: number | null; suffix?: string }) {
  if (delta === null || !Number.isFinite(delta)) {
    return <span className="chip chip--flat">مفيش مقارنة</span>;
  }
  const flat = Math.abs(delta) < 0.5;
  const up = delta > 0;
  const cls = flat ? "chip--flat" : up ? "chip--up" : "chip--down";
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <>
      <span className={`chip ${cls}`}>
        <Icon size={13} strokeWidth={2.4} aria-hidden="true" />
        <span className="num">{fmtPct(delta)}</span>
      </span>
      <span>{suffix}</span>
    </>
  );
}
