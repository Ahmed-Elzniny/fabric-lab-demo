// src/features/reports/CopyButton.tsx
"use client";

import { ClipboardCopy } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { toTSV } from "@/lib/tsv";
import { useDemo } from "@/store/DemoProvider";

/** نسخ الجدول بصيغة تتلصق في Excel كأعمدة */
export function CopyButton({ headers, rows, label = "نسخ لـ Excel" }: { headers: string[]; rows: (string | number)[][]; label?: string }) {
  const { notify } = useDemo();
  return (
    <button
      type="button"
      className="btn btn--outline btn--sm"
      onClick={async () => {
        const ok = await copyText(toTSV(headers, rows));
        notify(ok ? `اتنسخ ${rows.length} سطر — الصقه في Excel.` : "المتصفح منع النسخ.");
      }}
    >
      <ClipboardCopy size={14} aria-hidden="true" /> {label}
    </button>
  );
}
