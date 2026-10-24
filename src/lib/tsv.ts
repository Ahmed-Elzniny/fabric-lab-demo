// src/lib/tsv.ts
// تحويل جدول لنص مفصول بـ Tab — بيتلصق في Excel أو Google Sheets كأعمدة مظبوطة.
export function toTSV(headers: string[], rows: (string | number)[][]): string {
  const clean = (v: string | number) => (typeof v === "number" ? String(Math.round(v * 100) / 100) : v.replace(/[\t\n]/g, " "));
  return [headers, ...rows].map((r) => r.map(clean).join("\t")).join("\n");
}
