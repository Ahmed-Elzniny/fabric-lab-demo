// src/components/ui/Stepper.tsx
import { Minus, Plus } from "lucide-react";

interface StepperProps {
  value: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}

/** عدّاد (Stepper) لعدد التواب — زرار ناقص وزرار زايد */
export function Stepper({ value, max, onChange, label }: StepperProps) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0} aria-label={`قلّل ${label}`}>
        <Minus size={14} />
      </button>
      <output className="num" aria-live="polite">
        {value}
      </output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`زوّد ${label}`}>
        <Plus size={14} />
      </button>
    </div>
  );
}
