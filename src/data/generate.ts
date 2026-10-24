// src/data/generate.ts
// محاكاة 180 يوم من شغل أبو سعدة يوم بيوم، عشان كل الأرقام تطلع مترابطة ومنطقية:
// المخزون = المشتريات − المبيعات ± التحويلات، والخزنة = الافتتاحي + الوارد − المنصرف،
// ورصيد العميل = فواتيره − اللي دفعه. نفس الـ Seed = نفس البيانات.
import { createRng, type Rng } from "@/lib/random";
import { addDays, diffDays, isFriday, monthOf, toDate, weekday, type IsoDate } from "@/lib/dates";
import {
  ADVANCE_NOTES,
  COLORS,
  CUSTOMERS,
  DRIVERS,
  EMPLOYEES,
  EXPENSE_NOTES,
  ITEM_SUPPLIERS,
  ITEMS,
  SUPPLIERS,
  WAREHOUSES,
} from "./catalog";
import type {
  CashKind,
  CashTransaction,
  Customer,
  DemoDataset,
  DyeLot,
  Item,
  PayrollPayment,
  PurchaseInvoice,
  Roll,
  SalaryAdvance,
  SalesInvoice,
  SalesLine,
  Season,
  StockTransfer,
  WarehouseId,
} from "./types";

const HISTORY_DAYS = 180;
const CASH_RESERVE = 120_000;
const WAREHOUSE_IDS: WarehouseId[] = ["kerdasa", "mahalla"];

/** وزن الطلب على الموسم حسب الشهر (1..12) */
const SEASON_DEMAND: Record<Season, number[]> = {
  summer: [0.15, 0.15, 0.35, 0.7, 0.95, 1, 1, 0.85, 0.5, 0.25, 0.15, 0.1],
  winter: [0.9, 0.75, 0.4, 0.15, 0.05, 0.05, 0.1, 0.25, 0.6, 0.95, 1, 1],
};

const ITEM_POPULARITY: Record<string, number> = {
  viscose: 1.2,
  marasi: 1,
  "marasi-ahram": 0.9,
  mabosh: 0.8,
  linen: 0.6,
  jacquard: 1,
  "velvet-haidi": 1.2,
  freska: 0.9,
};

/** العملاء المتأخرين في السداد — عشان تنبيهات الديمو تبان حقيقية */
const SLOW_PAYERS = new Set(["c05", "c20", "c27", "c13"]);

function seasonWeight(season: Season, date: IsoDate): number {
  return SEASON_DEMAND[season][monthOf(date) - 1] ?? 0.5;
}

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

const round2 = (n: number) => Math.round(n * 100) / 100;
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

interface Payable {
  supplierId: string;
  amount: number;
}

export function generateDataset(today: IsoDate, seed = 20261024): DemoDataset {
  const rng: Rng = createRng(seed);
  const start = addDays(today, -(HISTORY_DAYS - 1));

  const lots: DyeLot[] = [];
  const rolls: Roll[] = [];
  const salesInvoices: SalesInvoice[] = [];
  const purchaseInvoices: PurchaseInvoice[] = [];
  const transfers: StockTransfer[] = [];
  const cash: CashTransaction[] = [];
  const advances: SalaryAdvance[] = [];
  const payroll: PayrollPayment[] = [];
  /** رصيد السلف المفتوح لكل موظف + القسط الحالي */
  const advanceOpen = new Map<string, { remaining: number; installment: number }>();

  const openingCash: Record<WarehouseId, number> = { kerdasa: 380_000, mahalla: 450_000 };
  const cashBalance: Record<WarehouseId, number> = { ...openingCash };
  const payables: Record<WarehouseId, Payable[]> = { kerdasa: [], mahalla: [] };
  const customerBalance = new Map<string, number>(CUSTOMERS.map((c) => [c.id, 0]));

  // المخزون المتاح: wh|item|color → تواب
  const available = new Map<string, Roll[]>();
  const keyOf = (wh: WarehouseId, itemId: string, colorId: string) => `${wh}|${itemId}|${colorId}`;
  const bucket = (k: string): Roll[] => {
    let b = available.get(k);
    if (!b) {
      b = [];
      available.set(k, b);
    }
    return b;
  };

  let lotSeq = 2310;
  let rollSeq = 0;
  let salesSeq = 10420;
  let purchaseSeq = 3105;
  let transferSeq = 410;
  let cashSeq = 0;
  let advanceSeq = 0;
  let payrollSeq = 0;

  const addCash = (date: IsoDate, wh: WarehouseId, kind: CashKind, amount: number, note: string, partyId?: string) => {
    if (amount === 0) return;
    cashBalance[wh] += amount;
    cash.push({ id: `cash-${++cashSeq}`, date, warehouseId: wh, kind, amount: round2(amount), note, partyId });
  };

  const createLot = (wh: WarehouseId, item: Item, colorId: string, date: IsoDate, rollCount: number): DyeLot => {
    const supplierId = rng.pick(ITEM_SUPPLIERS[item.id] ?? [SUPPLIERS[0]!.id]);
    const code = String(++lotSeq);
    const lot: DyeLot = {
      id: `lot-${code}`,
      code,
      itemId: item.id,
      colorId,
      supplierId,
      warehouseId: wh,
      receivedOn: date,
      unitCost: roundTo(item.baseCost * rng.float(0.955, 1.045), 0.5),
      rollCount,
    };
    lots.push(lot);
    const b = bucket(keyOf(wh, item.id, colorId));
    for (let i = 1; i <= rollCount; i++) {
      const quantity =
        item.unit === "meter"
          ? roundTo(item.nominalRollSize + rng.float(-1.5, 4.5), 0.5)
          : round2(item.nominalRollSize + rng.float(-4, 8));
      const roll: Roll = {
        id: `roll-${++rollSeq}`,
        code: `${code}-${String(i).padStart(2, "0")}`,
        lotId: lot.id,
        itemId: item.id,
        colorId,
        warehouseId: wh,
        quantity,
        status: "available",
        receivedOn: date,
      };
      rolls.push(roll);
      b.push(roll);
    }
    return lot;
  };

  const lotById = new Map<string, DyeLot>();
  const lotCost = (lotId: string) => lotById.get(lotId)?.unitCost ?? 0;

  // ───────────── المخزون الافتتاحي ─────────────
  for (const wh of WAREHOUSE_IDS) {
    for (const item of ITEMS) {
      const w = seasonWeight(item.season, start);
      for (const colorId of item.colorIds) {
        const lotCount = w > 0.5 ? 2 : 1;
        for (let l = 0; l < lotCount; l++) {
          const size = Math.max(3, Math.round(rng.int(5, 11) * (0.35 + w)));
          const lot = createLot(wh, item, colorId, addDays(start, -rng.int(8, 75)), size);
          lotById.set(lot.id, lot);
        }
      }
    }
  }

  const pendingTransfers: StockTransfer[] = [];

  // ───────────── المحاكاة يوم بيوم ─────────────
  for (let day = 0; day < HISTORY_DAYS; day++) {
    const date = addDays(start, day);
    const isToday = date === today;

    // 1) استلام التحويلات اللي وصلت
    for (let i = pendingTransfers.length - 1; i >= 0; i--) {
      const t = pendingTransfers[i]!;
      if (diffDays(date, t.date) >= 1) {
        t.status = "received";
        t.receivedOn = date;
        for (const rid of t.rollIds) {
          const roll = rolls[Number(rid.slice(5)) - 1]!;
          roll.status = "available";
          roll.warehouseId = t.toWarehouseId;
          bucket(keyOf(t.toWarehouseId, roll.itemId, roll.colorId)).push(roll);
        }
        pendingTransfers.splice(i, 1);
      }
    }

    if (isFriday(date)) continue; // الجمعة إجازة

    const dayFactor = weekday(date) === 4 ? 1.3 : weekday(date) === 6 ? 1.1 : 1;

    for (const wh of WAREHOUSE_IDS) {
      // 2) المشتريات: التاجر بيشتري قبل الموسم بشهر تقريباً
      const bySupplier = new Map<string, DyeLot[]>();
      let lotsToday = 0;
      for (const item of ITEMS) {
        const ahead = seasonWeight(item.season, addDays(date, 25));
        const target = Math.round(3 + 15 * ahead);
        for (const colorId of item.colorIds) {
          if (lotsToday >= 3) break;
          const have = bucket(keyOf(wh, item.id, colorId)).length;
          if (have < target * 0.45 && rng.chance(0.22)) {
            const lot = createLot(wh, item, colorId, date, Math.max(4, target + rng.int(-2, 5)));
            lotById.set(lot.id, lot);
            lotsToday++;
            const list = bySupplier.get(lot.supplierId) ?? [];
            list.push(lot);
            bySupplier.set(lot.supplierId, list);
          }
        }
      }
      for (const [supplierId, supplierLots] of bySupplier) {
        const total = round2(
          supplierLots.reduce(
            (s, lot) =>
              s +
              rolls
                .filter((r) => r.lotId === lot.id)
                .reduce((q, r) => q + r.quantity, 0) *
                lot.unitCost,
            0,
          ),
        );
        const wanted = total * rng.float(0.35, 0.6);
        const paidNow = roundTo(Math.max(0, Math.min(wanted, cashBalance[wh] - CASH_RESERVE)), 1000);
        purchaseInvoices.push({
          id: `po-${++purchaseSeq}`,
          number: `PO-${purchaseSeq}`,
          date,
          warehouseId: wh,
          supplierId,
          lotIds: supplierLots.map((l) => l.id),
          total,
          paidNow,
        });
        const supplierName = SUPPLIERS.find((s) => s.id === supplierId)?.name ?? "";
        addCash(date, wh, "supplier_payment", -paidNow, `دفعة مع فاتورة PO-${purchaseSeq} — ${supplierName}`, supplierId);
        if (total - paidNow > 0) payables[wh].push({ supplierId, amount: round2(total - paidNow) });
      }

      // 3) المبيعات: البيع بالتوب، والعميل بياخد الصنف بتشكيلة ألوانه
      const lambda = 1.3 * (wh === "mahalla" ? 1.12 : 1) * dayFactor * (isToday ? 0.55 : 1);
      let invoiceCount = 0;
      for (let p = Math.exp(-lambda), u = rng.next(); u > p; u *= rng.next()) invoiceCount++;
      if (isToday) invoiceCount = Math.max(invoiceCount, 2); // يوم الديمو: فيه حركة بيع من الصبح

      for (let n = 0; n < invoiceCount; n++) {
        const customer = pickCustomer(rng, wh, customerBalance);
        const lineCount = rng.chance(0.2) ? 2 : 1;
        const lines: SalesLine[] = [];
        const usedItems = new Set<string>();

        for (let li = 0; li < lineCount; li++) {
          let item: Item | undefined;
          for (let attempt = 0; attempt < 4; attempt++) {
            const candidate = rng.weighted(ITEMS, (it) =>
              usedItems.has(it.id) ? 0 : seasonWeight(it.season, date) * (ITEM_POPULARITY[it.id] ?? 1),
            );
            const colorsInStock = candidate.colorIds.filter((c) => bucket(keyOf(wh, candidate.id, c)).length > 0).length;
            if (colorsInStock >= Math.ceil(candidate.colorIds.length / 2)) {
              item = candidate;
              break;
            }
          }
          if (!item) continue;
          usedItems.add(item.id);

          const perColor = rng.chance(0.7) ? 1 : rng.chance(0.85) ? 2 : 3;
          const unitPrice = roundTo(item.salePrice * rng.float(0.975, 1.035), 0.5);

          for (const colorId of item.colorIds) {
            const b = bucket(keyOf(wh, item.id, colorId));
            if (b.length === 0) continue; // لون ناقص = مبيعة ضايعة
            const picked = pickFromSameLot(b, perColor);
            if (picked.length === 0) continue;
            const quantity = round2(picked.reduce((s, r) => s + r.quantity, 0));
            const lotId = picked[0]!.lotId;
            lines.push({
              itemId: item.id,
              colorId,
              lotId,
              rollIds: picked.map((r) => r.id),
              quantity,
              unitPrice,
              total: round2(quantity * unitPrice),
              cost: round2(quantity * lotCost(lotId)),
            });
            for (const r of picked) {
              r.status = "sold";
              r.soldOn = date;
            }
          }
        }
        if (lines.length === 0) continue;

        const id = `inv-${++salesSeq}`;
        for (const line of lines) for (const rid of line.rollIds) rolls[Number(rid.slice(5)) - 1]!.invoiceId = id;
        const total = round2(lines.reduce((s, l) => s + l.total, 0));
        const cost = round2(lines.reduce((s, l) => s + l.cost, 0));
        const r = rng.next();
        const paidFraction = SLOW_PAYERS.has(customer.id) ? 0 : r < 0.33 ? 0 : r < 0.8 ? rng.float(0.25, 0.6) : 1;
        const paidNow = paidFraction === 1 ? total : roundTo(total * paidFraction, 1000);
        salesInvoices.push({
          id,
          number: `INV-${salesSeq}`,
          date,
          warehouseId: wh,
          customerId: customer.id,
          lines,
          total,
          cost,
          paidNow,
          rollCount: lines.reduce((s, l) => s + l.rollIds.length, 0),
        });
        customerBalance.set(customer.id, (customerBalance.get(customer.id) ?? 0) + total - paidNow);
        addCash(date, wh, "cash_sale", paidNow, `نقدي فاتورة INV-${salesSeq} — ${customer.name}`, customer.id);
      }

      // 4) المصروفات اليومية
      const expenseCount = rng.int(1, 3);
      for (let e = 0; e < expenseCount; e++) {
        addCash(date, wh, "expense", -roundTo(rng.float(150, 2400), 50), rng.pick(EXPENSE_NOTES));
      }

      // 5) سداد الموردين من الفايض عن الاحتياطي
      let budget = Math.max(0, (cashBalance[wh] - CASH_RESERVE * 2) * 0.7);
      while (budget > 5000 && payables[wh].length > 0) {
        const p = payables[wh][0]!;
        const pay = p.amount <= budget ? p.amount : Math.floor(budget / 1000) * 1000;
        if (pay <= 0) break;
        const supplierName = SUPPLIERS.find((s) => s.id === p.supplierId)?.name ?? "";
        addCash(date, wh, "supplier_payment", -pay, `سداد للمورد — ${supplierName}`, p.supplierId);
        p.amount = round2(p.amount - pay);
        budget -= pay;
        if (p.amount <= 1) payables[wh].shift();
      }
    }

    // 5ب) العمالة: سلف + أسبوعيات الخميس + مرتبات أول الشهر
    for (const emp of EMPLOYEES) {
      // سلفة جديدة (مش لو عليه سلفة كبيرة مفتوحة)
      const open = advanceOpen.get(emp.id);
      const monthlyWage = emp.payType === "weekly" ? emp.wage * 4.33 : emp.wage;
      const pChance = emp.payType === "weekly" ? 0.022 : 0.014;
      if ((!open || open.remaining < monthlyWage * 0.25) && rng.chance(pChance)) {
        const amount = roundTo(
          emp.payType === "weekly" ? rng.float(0.3, 1.4) * emp.wage : rng.float(0.15, 0.6) * emp.wage,
          100,
        );
        const installment = roundTo(
          emp.payType === "weekly" ? Math.max(200, amount / rng.int(2, 4)) : Math.max(500, amount / rng.int(2, 3)),
          50,
        );
        advances.push({
          id: `adv-${++advanceSeq}`,
          employeeId: emp.id,
          warehouseId: emp.warehouseId,
          date,
          amount,
          installment,
          note: rng.pick(ADVANCE_NOTES),
        });
        const cur = advanceOpen.get(emp.id) ?? { remaining: 0, installment: 0 };
        advanceOpen.set(emp.id, { remaining: cur.remaining + amount, installment: Math.max(cur.installment, installment) });
        addCash(date, emp.warehouseId, "advance", -amount, `سلفة — ${emp.name}`, emp.id);
      }
    }

    const isThursday = weekday(date) === 4;
    const dom = toDate(date).getUTCDate();
    // أول الشهر، ولو وقع جمعة يتقبض السبت
    const isMonthlyPayday = dom === 1 || (dom === 2 && isFriday(addDays(date, -1)));
    for (const emp of EMPLOYEES) {
      const due = emp.payType === "weekly" ? isThursday : isMonthlyPayday;
      if (!due) continue;
      const open = advanceOpen.get(emp.id);
      const deduction = open ? Math.min(open.remaining, open.installment, emp.wage * 0.5) : 0;
      if (open) {
        open.remaining = round2(open.remaining - deduction);
        if (open.remaining <= 0) advanceOpen.delete(emp.id);
      }
      const net = round2(emp.wage - deduction);
      const periodLabel =
        emp.payType === "weekly"
          ? `أسبوعية ${date.slice(8, 10)}/${date.slice(5, 7)}`
          : `مرتب شهر ${MONTHS_AR[(monthOf(addDays(date, -3)) + 11) % 12]}`;
      payroll.push({
        id: `pay-${++payrollSeq}`,
        employeeId: emp.id,
        warehouseId: emp.warehouseId,
        date,
        payType: emp.payType,
        periodLabel,
        gross: emp.wage,
        advanceDeduction: deduction,
        net,
      });
      addCash(date, emp.warehouseId, "salary", -net, `${periodLabel} — ${emp.name}`, emp.id);
    }

    // 6) تحصيلات العملاء
    for (const c of CUSTOMERS) {
      const bal = customerBalance.get(c.id) ?? 0;
      if (bal <= 2000) continue;
      const p = SLOW_PAYERS.has(c.id) ? 0.006 : 0.075;
      if (!rng.chance(p)) continue;
      const amount = bal < 15_000 ? roundTo(bal, 50) : roundTo(bal * rng.float(0.25, 0.7), 1000);
      customerBalance.set(c.id, bal - amount);
      addCash(date, c.homeWarehouseId, "collection", amount, `تحصيل من ${c.name}`, c.id);
    }

    // 7) تحويل نقدية بين الخزنتين كل فترة
    if (day % 13 === 6) {
      const [rich, poor] =
        cashBalance.mahalla > cashBalance.kerdasa ? (["mahalla", "kerdasa"] as const) : (["kerdasa", "mahalla"] as const);
      const gap = cashBalance[rich] - cashBalance[poor];
      if (gap > 250_000) {
        const amount = roundTo(gap * 0.35, 10_000);
        addCash(date, rich, "cash_transfer_out", -amount, `تحويل نقدية إلى خزنة ${rich === "mahalla" ? "كرداسة" : "المحلة"}`);
        addCash(date, poor, "cash_transfer_in", amount, `تحويل نقدية من خزنة ${rich === "mahalla" ? "المحلة" : "كرداسة"}`);
      }
    }

    // 8) تحويلات بضاعة بين المخزنين لتكملة التشكيلات الناقصة
    const transferCount = isToday ? 2 : rng.chance(0.3) ? 1 : 0;
    for (let t = 0; t < transferCount; t++) {
      const from: WarehouseId = isToday || rng.chance(0.6) ? "mahalla" : "kerdasa";
      const to: WarehouseId = from === "mahalla" ? "kerdasa" : "mahalla";
      let best: { item: Item; colorId: string; gap: number } | null = null;
      for (const item of ITEMS) {
        if (seasonWeight(item.season, date) < 0.5) continue;
        for (const colorId of item.colorIds) {
          const src = bucket(keyOf(from, item.id, colorId)).length;
          const dst = bucket(keyOf(to, item.id, colorId)).length;
          const gap = src - dst;
          const eligible = isToday ? src >= 6 && gap >= 4 : dst <= 6 && src >= dst + 8;
          const already = transfers.some(
            (x) => x.date === date && rolls[Number(x.rollIds[0]!.slice(5)) - 1]!.colorId === colorId && rolls[Number(x.rollIds[0]!.slice(5)) - 1]!.itemId === item.id,
          );
          const score = gap - dst * 2; // الأولوية للون اللي ناقص أكتر في المخزن التاني
          if (eligible && !already && (!best || score > best.gap)) best = { item, colorId, gap: score };
        }
      }
      if (!best) continue;
      const moving = pickFromSameLot(bucket(keyOf(from, best.item.id, best.colorId)), rng.int(4, 6));
      if (moving.length === 0) continue;
      for (const r of moving) {
        r.status = "in_transit";
        r.warehouseId = to;
      }
      const transfer: StockTransfer = {
        id: `tr-${++transferSeq}`,
        number: `TR-${transferSeq}`,
        date,
        fromWarehouseId: from,
        toWarehouseId: to,
        rollIds: moving.map((r) => r.id),
        status: "in_transit",
        driver: rng.pick(DRIVERS),
      };
      transfers.push(transfer);
      pendingTransfers.push(transfer);
    }

    // 9) إيداع الفايض في البنك — التاجر مابيسيبش ملايين في الخزنة
    for (const wh of WAREHOUSE_IDS) {
      if (cashBalance[wh] > 1_150_000 && payables[wh].length === 0 && rng.chance(0.35)) {
        const amount = roundTo(cashBalance[wh] - rng.int(550_000, 750_000), 10_000);
        addCash(date, wh, "bank_deposit", -amount, "إيداع في حساب البنك الأهلي");
      }
    }
  }

  return {
    today,
    warehouses: WAREHOUSES,
    items: ITEMS,
    colors: COLORS,
    customers: CUSTOMERS,
    suppliers: SUPPLIERS,
    lots,
    rolls,
    salesInvoices,
    purchaseInvoices,
    transfers,
    cash,
    employees: EMPLOYEES,
    advances,
    payroll,
    openingCash,
  };
}

/** يختار التواب من نفس الطبخة (FIFO) — شرط أساسي في القماش عشان درجة اللون تبقى واحدة */
function pickFromSameLot(bucketRolls: Roll[], count: number): Roll[] {
  const byLot = new Map<string, Roll[]>();
  for (const r of bucketRolls) {
    const list = byLot.get(r.lotId) ?? [];
    list.push(r);
    byLot.set(r.lotId, list);
  }
  const groups = [...byLot.values()].sort((a, b) => (a[0]!.receivedOn < b[0]!.receivedOn ? -1 : 1));
  const enough = groups.find((g) => g.length >= count);
  const chosen = enough ?? groups.reduce<Roll[]>((best, g) => (g.length > best.length ? g : best), []);
  const picked = chosen.slice(0, Math.min(count, chosen.length));
  const ids = new Set(picked.map((r) => r.id));
  for (let i = bucketRolls.length - 1; i >= 0; i--) if (ids.has(bucketRolls[i]!.id)) bucketRolls.splice(i, 1);
  return picked;
}

function pickCustomer(rng: Rng, wh: WarehouseId, balances: Map<string, number>): Customer {
  const fromHome = rng.chance(0.9);
  const pool = CUSTOMERS.filter((c) => (fromHome ? c.homeWarehouseId === wh : c.homeWarehouseId !== wh));
  const list = pool.length > 0 ? pool : CUSTOMERS;
  return rng.weighted(list, (c) => {
    const bal = balances.get(c.id) ?? 0;
    const overLimit = bal > c.creditLimit ? 0.15 : 1;
    const slow = SLOW_PAYERS.has(c.id) && bal > c.creditLimit * 0.6 ? 0 : 1;
    return c.creditLimit * overLimit * slow;
  });
}
