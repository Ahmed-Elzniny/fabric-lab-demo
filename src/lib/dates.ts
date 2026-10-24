// src/lib/dates.ts
// تواريخ بصيغة ISO (YYYY-MM-DD) بحساب UTC، عشان مايحصلش فرق يوم بسبب المنطقة الزمنية.

export type IsoDate = string;

export function todayIso(): IsoDate {
  const now = new Date();
  // تاريخ اليوم حسب جهاز المستخدم
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function toDate(iso: IsoDate): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((toDate(a).getTime() - toDate(b).getTime()) / 86_400_000);
}

/** 0 = الأحد ... 5 = الجمعة */
export function weekday(iso: IsoDate): number {
  return toDate(iso).getUTCDay();
}

/** 1..12 */
export function monthOf(iso: IsoDate): number {
  return toDate(iso).getUTCMonth() + 1;
}

export function isFriday(iso: IsoDate): boolean {
  return weekday(iso) === 5;
}
