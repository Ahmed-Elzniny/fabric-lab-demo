// src/data/types.ts
// أنواع البيانات (Types) — مصممة بنفس شكل استجابات Django REST Framework المستقبلية،
// عشان لما نوصّل الـ Backend نبدّل مصدر البيانات بس من غير ما نلمس الشاشات.

export type WarehouseId = "kerdasa" | "mahalla";
export type Unit = "meter" | "kg";
export type Season = "summer" | "winter";

export interface Warehouse {
  id: WarehouseId;
  name: string;
  city: string;
  manager: string;
}

/** الصنف (Item): نوع القماش نفسه. اللون بيتحدد على مستوى الطبخة. */
export interface Item {
  id: string;
  name: string;
  season: Season;
  unit: Unit;
  /** متوسط طول/وزن التوب: 60 متر للصيفي، 100 كيلو للشتوي */
  nominalRollSize: number;
  /** سعر البيع للمتر أو للكيلو (ج.م) */
  salePrice: number;
  /** متوسط تكلفة الشراء للمتر أو للكيلو (ج.م) */
  baseCost: number;
  /** الألوان اللي بيتباع بيها الصنف كتشكيلة */
  colorIds: string[];
}

export interface FabricColor {
  id: string;
  name: string;
  hex: string;
}

/** الطبخة (Dye Lot): دفعة اتصبغت مع بعض لصنف ولون معيّن */
export interface DyeLot {
  id: string;
  code: string;
  itemId: string;
  colorId: string;
  supplierId: string;
  warehouseId: WarehouseId;
  receivedOn: string; // ISO date
  unitCost: number;
  rollCount: number;
}

export type RollStatus = "available" | "sold" | "in_transit";

/** التوب (Roll): الوحدة الفعلية في المخزن، بطوله أو وزنه الحقيقي */
export interface Roll {
  id: string;
  code: string;
  lotId: string;
  itemId: string;
  colorId: string;
  warehouseId: WarehouseId;
  quantity: number; // متر أو كيلو حسب وحدة الصنف
  status: RollStatus;
  receivedOn: string;
  soldOn?: string;
  invoiceId?: string;
}

export interface Customer {
  id: string;
  name: string;
  area: string;
  phone: string;
  homeWarehouseId: WarehouseId;
  creditLimit: number;
}

export interface Supplier {
  id: string;
  name: string;
  city: string;
}

export interface SalesLine {
  itemId: string;
  colorId: string;
  lotId: string;
  rollIds: string[];
  quantity: number; // مجموع الأمتار أو الكيلوهات الفعلية
  unitPrice: number;
  total: number;
  cost: number;
}

export interface SalesInvoice {
  id: string;
  number: string;
  date: string;
  warehouseId: WarehouseId;
  customerId: string;
  lines: SalesLine[];
  total: number;
  cost: number;
  paidNow: number;
  rollCount: number;
  /** خصم على إجمالي الفاتورة (ج.م) — total بعد الخصم */
  discount?: number;
  /** اسم المستخدم اللي سجّل الفاتورة (للفواتير اللي اتعملت في الديمو) */
  createdBy?: string;
}

export interface PurchaseInvoice {
  id: string;
  number: string;
  date: string;
  warehouseId: WarehouseId;
  supplierId: string;
  lotIds: string[];
  total: number;
  paidNow: number;
  /** رقم فاتورة المورد الورقية */
  supplierRef?: string;
  /** مصاريف نقل وتحميل اتوزعت على تكلفة الطبخات */
  extraCost?: number;
  createdBy?: string;
}

export type TransferStatus = "in_transit" | "received";

export interface StockTransfer {
  id: string;
  number: string;
  date: string;
  fromWarehouseId: WarehouseId;
  toWarehouseId: WarehouseId;
  rollIds: string[];
  status: TransferStatus;
  receivedOn?: string;
  driver: string;
  note?: string;
  createdBy?: string;
  receivedBy?: string;
}

export type CashKind =
  | "cash_sale"
  | "collection"
  | "supplier_payment"
  | "expense"
  | "cash_transfer_in"
  | "cash_transfer_out"
  | "bank_deposit"
  | "salary"
  | "advance"
  | "adjustment";

export interface CashTransaction {
  id: string;
  date: string;
  warehouseId: WarehouseId;
  kind: CashKind;
  amount: number; // موجب = وارد، سالب = منصرف
  note: string;
  partyId?: string;
  /** طريقة الدفع للتحصيلات: النقدي بس اللي بيدخل الخزنة، والتحويل البنكي وإنستاباي بيروحوا للبنك */
  method?: PaymentMethod;
  /** المستخدم اللي سجّل الحركة (للحركات اللي اتعملت في الديمو) */
  createdBy?: string;
}

export type PaymentMethod = "cash" | "bank" | "instapay";

/* ───────────── العمالة (Workforce) ───────────── */

/** monthly = مرتب شهري بيتقبض أول الشهر، weekly = أسبوعية بتتقبض يوم الخميس */
export type PayType = "monthly" | "weekly";

export interface Employee {
  id: string;
  name: string;
  jobTitle: string;
  warehouseId: WarehouseId;
  payType: PayType;
  /** قيمة المرتب الشهري أو الأسبوعية (ج.م) */
  wage: number;
  hiredOn: string;
  phone: string;
}

/** السلفة: بتتصرف من خزنة المخزن وبتتخصم من المرتب على أقساط */
export interface SalaryAdvance {
  id: string;
  employeeId: string;
  warehouseId: WarehouseId;
  date: string;
  amount: number;
  /** القسط اللي بيتخصم من كل قبضة */
  installment: number;
  note: string;
  createdBy?: string;
}

export interface PayrollPayment {
  id: string;
  employeeId: string;
  warehouseId: WarehouseId;
  date: string;
  payType: PayType;
  /** الفترة: "أسبوع 17 أكتوبر" أو "مرتب أكتوبر" */
  periodLabel: string;
  gross: number;
  advanceDeduction: number;
  net: number;
  /** إضافي (أوفر تايم / مكافأة) */
  bonus?: number;
  /** خصم (غياب / جزاء) */
  penalty?: number;
  createdBy?: string;
}

/** تقفيل يومية الخزنة: المبلغ المعدود فعلياً مقابل رصيد السيستم */
export interface CashClosing {
  id: string;
  date: string;
  warehouseId: WarehouseId;
  expected: number;
  counted: number;
  difference: number;
  note?: string;
  closedBy: string;
}

export interface DemoDataset {
  today: string;
  warehouses: Warehouse[];
  items: Item[];
  colors: FabricColor[];
  customers: Customer[];
  suppliers: Supplier[];
  lots: DyeLot[];
  rolls: Roll[];
  salesInvoices: SalesInvoice[];
  purchaseInvoices: PurchaseInvoice[];
  transfers: StockTransfer[];
  cash: CashTransaction[];
  employees: Employee[];
  advances: SalaryAdvance[];
  payroll: PayrollPayment[];
  closings?: CashClosing[];
  openingCash: Record<WarehouseId, number>;
}
