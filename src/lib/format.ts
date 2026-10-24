// src/lib/format.ts
// تنسيق الأرقام والتواريخ بالعربي مع أرقام لاتينية (1, 2, 3) عشان تبقى واضحة في الجداول.
import { toDate, type IsoDate } from "./dates";

const LOCALE = "ar-EG-u-nu-latn";

const intFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const oneDecFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const pctFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1, signDisplay: "exceptZero" });

export const fmtInt = (n: number) => intFmt.format(Math.round(n));
export const fmtQty = (n: number) => oneDecFmt.format(n);

/** مبلغ كامل: 1,245,300 ج.م */
export const fmtMoney = (n: number) => `${intFmt.format(Math.round(n))} ج.م`;

/** مبلغ مختصر للكروت والمحاور: 2.4 مليون / 845 ألف */
export function fmtMoneyShort(n: number, withCurrency = true): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  let body: string;
  if (abs >= 1_000_000) body = `${oneDecFmt.format(abs / 1_000_000)} مليون`;
  else if (abs >= 1_000) body = `${intFmt.format(abs / 1_000)} ألف`;
  else body = intFmt.format(abs);
  return `${sign}${body}${withCurrency ? " ج.م" : ""}`;
}

/** محور الرسم البياني: 2.4م / 850ك */
export function fmtAxis(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${oneDecFmt.format(n / 1_000_000)}م`;
  if (Math.abs(n) >= 1_000) return `${intFmt.format(n / 1_000)}ك`;
  return intFmt.format(n);
}

export const fmtPct = (n: number) => `${pctFmt.format(n)}٪`;

const dayMonthFmt = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", timeZone: "UTC" });
const fullDateFmt = new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const weekdayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: "short", timeZone: "UTC" });

export const fmtDayMonth = (iso: IsoDate) => dayMonthFmt.format(toDate(iso));
export const fmtFullDate = (iso: IsoDate) => fullDateFmt.format(toDate(iso));
export const fmtWeekday = (iso: IsoDate) => weekdayFmt.format(toDate(iso));

export function fmtUnit(unit: "meter" | "kg", qty: number): string {
  return unit === "meter" ? `${fmtQty(qty)} م` : `${fmtQty(qty)} كجم`;
}

export function daysAgoLabel(days: number): string {
  if (days <= 0) return "النهارده";
  if (days === 1) return "امبارح";
  if (days === 2) return "من يومين";
  if (days <= 10) return `من ${days} أيام`;
  return `من ${days} يوم`;
}
