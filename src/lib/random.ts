// src/lib/random.ts
// مولّد أرقام عشوائية ثابت (Seeded PRNG) — نفس الـ Seed بيطلع نفس البيانات في كل مرة،
// عشان الديمو يبان متماسك ويتكرر بنفس الشكل قدام العميل.

export interface Rng {
  next(): number; // [0, 1)
  int(min: number, max: number): number; // شامل الطرفين
  float(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(list: readonly T[]): T;
  weighted<T>(list: readonly T[], weight: (x: T) => number): T;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const pick = <T,>(list: readonly T[]): T => {
    if (list.length === 0) throw new Error("pick() على قائمة فاضية");
    return list[Math.floor(next() * list.length)] as T;
  };

  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    float: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick,
    weighted: <T,>(list: readonly T[], weight: (x: T) => number): T => {
      const total = list.reduce((s, x) => s + Math.max(0, weight(x)), 0);
      if (total <= 0) return pick(list);
      let r = next() * total;
      for (const x of list) {
        r -= Math.max(0, weight(x));
        if (r <= 0) return x;
      }
      return list[list.length - 1] as T;
    },
  };
}
