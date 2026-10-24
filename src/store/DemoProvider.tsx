// src/store/DemoProvider.tsx
"use client";

// حالة الديمو العامة (Global State): البيانات، الفلاتر، المستخدم الحالي، الشاشة المفتوحة، والثيم.
// استخدمنا React Context بدل مكتبة خارجية لأن الحالة صغيرة ومفيش داعي لاعتمادية زيادة.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { generateDataset } from "@/data/generate";
import { buildIndexes, type Indexes, type Period, type WarehouseFilter } from "@/data/selectors";
import { commitInvoice, type InvoiceDraft } from "@/data/sales";
import { commitCollection, type CollectionDraft } from "@/data/customers";
import { commitAdvance, commitPayroll, type AdvanceDraft, type PayrollLineInput } from "@/data/workforce";
import { commitPurchase, commitSupplierPayment, type PurchaseDraft, type SupplierPaymentDraft } from "@/data/purchases";
import { commitClosing, commitExpense } from "@/data/cashbook";
import {
  commitCashTransfer,
  commitTransfer,
  receiveTransfer as receiveTransferFn,
  type CashTransferDraft,
  type TransferDraft,
} from "@/data/transfers";
import type {
  CashClosing,
  CashTransaction,
  DemoDataset,
  PayType,
  PayrollPayment,
  PurchaseInvoice,
  SalaryAdvance,
  SalesInvoice,
  StockTransfer,
  WarehouseId,
} from "@/data/types";
import { todayIso } from "@/lib/dates";

export type Role = "owner" | "storekeeper";
export type ViewId =
  | "dashboard"
  | "inventory"
  | "sales"
  | "sales_new"
  | "purchases"
  | "purchases_new"
  | "transfers"
  | "transfers_new"
  | "customers"
  | "suppliers"
  | "cash"
  | "workforce"
  | "reports"
  | "settings";
export type ThemeChoice = "system" | "light" | "dark";

interface DemoState {
  ds: DemoDataset;
  ix: Indexes;
  view: ViewId;
  setView: (v: ViewId) => void;
  warehouse: WarehouseFilter;
  setWarehouse: (w: WarehouseFilter) => void;
  period: Period;
  setPeriod: (p: Period) => void;
  role: Role;
  setRole: (r: Role) => void;
  theme: ThemeChoice;
  setTheme: (t: ThemeChoice) => void;
  /** بيزيد مع كل تغيير في الثيم الفعلي — الرسوم بتعيد قراءة الألوان */
  themeVersion: number;
  /** صلاحيات المستخدم الحالي */
  can: {
    seeProfit: boolean;
    seeAllWarehouses: boolean;
    exceedCreditLimit: boolean;
    transferCash: boolean;
    /** مسموح يتعامل مع المخزن ده (يبيع منه، يبعت منه، يستلم فيه) */
    access: (w: WarehouseId) => boolean;
  };
  /** اسم المستخدم الحالي (بيتسجل على الفواتير) */
  userName: string;

  /* ───── عمليات بتغيّر البيانات ───── */
  createInvoice: (draft: Omit<InvoiceDraft, "createdBy">) => SalesInvoice;
  createTransfer: (draft: Omit<TransferDraft, "createdBy">) => StockTransfer;
  receiveTransfer: (id: string) => StockTransfer;
  transferCash: (draft: Omit<CashTransferDraft, "createdBy">) => void;
  recordCollection: (draft: Omit<CollectionDraft, "createdBy">) => CashTransaction;
  runPayroll: (type: PayType, lines: PayrollLineInput[]) => PayrollPayment[];
  giveAdvance: (draft: Omit<AdvanceDraft, "createdBy">) => SalaryAdvance;
  createPurchase: (draft: Omit<PurchaseDraft, "createdBy">) => PurchaseInvoice;
  paySupplier: (draft: Omit<SupplierPaymentDraft, "createdBy">) => void;
  addExpense: (d: { warehouseId: WarehouseId; amount: number; category: string; note: string }) => void;
  closeCashDay: (d: { warehouseId: WarehouseId; counted: number; note: string }) => CashClosing;
  updateItemPrice: (itemId: string, salePrice: number) => void;
  openSupplierId: string | null;
  openSupplier: (id: string | null) => void;
  openPurchaseId: string | null;
  openPurchase: (id: string | null) => void;
  /** البيانات اتغيّرت عن الأصل (اتعملت فواتير في الديمو) */
  dirty: boolean;
  resetDemo: () => void;

  /* ───── واجهة عامة ───── */
  openInvoiceId: string | null;
  openInvoice: (id: string | null) => void;
  /** تفاصيل طبخة في لوحة جانبية، مع إبراز توب معيّن لو جاي من البحث */
  openLot: { lotId: string; rollId?: string } | null;
  setOpenLot: (v: { lotId: string; rollId?: string } | null) => void;
  /** نص البحث في شاشة المخزون (بيتملى من خانة البحث اللي فوق) */
  inventoryQuery: string;
  setInventoryQuery: (q: string) => void;
  /** كشف حساب عميل في لوحة جانبية */
  openCustomerId: string | null;
  openCustomer: (id: string | null) => void;
  /** فاتورة جديدة بعميل متختار مقدماً (من كشف الحساب) */
  invoiceCustomerIntent: string | null;
  newInvoiceFor: (customerId: string | null) => void;
  /** كشف حساب موظف في لوحة جانبية */
  openEmployeeId: string | null;
  openEmployee: (id: string | null) => void;
  toast: { id: number; message: string } | null;
  notify: (message: string) => void;
}

const DemoContext = createContext<DemoState | null>(null);

const THEME_KEY = "nazzam-fabric-demo:theme";

function readStoredTheme(): ThemeChoice {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch {
    return "system";
  }
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [ds, setDs] = useState<DemoDataset | null>(null);
  const [view, setView] = useState<ViewId>("dashboard");
  const [warehouse, setWarehouseRaw] = useState<WarehouseFilter>("all");
  const [period, setPeriod] = useState<Period>("30d");
  const [role, setRoleRaw] = useState<Role>("owner");
  const [theme, setThemeRaw] = useState<ThemeChoice>("system");
  const [themeVersion, setThemeVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [openLot, setOpenLot] = useState<{ lotId: string; rollId?: string } | null>(null);
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [openCustomerId, setOpenCustomerId] = useState<string | null>(null);
  const [invoiceCustomerIntent, setInvoiceCustomerIntent] = useState<string | null>(null);
  const [openEmployeeId, setOpenEmployeeId] = useState<string | null>(null);
  const [openPurchaseId, setOpenPurchaseId] = useState<string | null>(null);
  const [openSupplierId, setOpenSupplierId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const dsRef = useRef<DemoDataset | null>(null);
  dsRef.current = ds;

  // البيانات بتتولد على جهاز المستخدم بتاريخ النهارده، عشان الديمو يفضل "طازة" في أي يوم يتعرض فيه
  useEffect(() => {
    setDs(generateDataset(todayIso()));
    setThemeRaw(readStoredTheme());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* التخزين ممكن يكون مقفول — الديمو يشتغل عادي */
    }
    setThemeVersion((v) => v + 1);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setThemeVersion((v) => v + 1);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setRole = useCallback((r: Role) => {
    setRoleRaw(r);
    // أمين مخزن كرداسة يشوف مخزنه بس
    if (r === "storekeeper") {
      setWarehouseRaw("kerdasa");
      setView((v) => (v === "workforce" || v === "reports" || v === "settings" || v === "suppliers" ? "dashboard" : v));
      setOpenEmployeeId(null);
    }
  }, []);

  const setWarehouse = useCallback(
    (w: WarehouseFilter) => {
      if (role === "storekeeper") return;
      setWarehouseRaw(w);
    },
    [role],
  );

  const ix = useMemo(() => (ds ? buildIndexes(ds) : null), [ds]);
  const ixRef = useRef(ix);
  ixRef.current = ix;

  const notify = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const userName = role === "owner" ? "الحاج أبو سعدة" : "محمود عبد الرحيم";

  const createInvoice = useCallback(
    (draft: Omit<InvoiceDraft, "createdBy">): SalesInvoice => {
      const current = dsRef.current;
      const currentIx = ixRef.current;
      if (!current || !currentIx) throw new Error("البيانات لسه بتتحمّل");
      // أمين المخزن مايقدرش يبيع غير من مخزنه — نفس القاعدة هتتطبق في الـ API
      if (role === "storekeeper" && draft.warehouseId !== "kerdasa") throw new Error("مسموح لك تبيع من مخزن كرداسة بس.");
      const res = commitInvoice(current, currentIx, { ...draft, createdBy: userName });
      dsRef.current = res.ds;
      setDs(res.ds);
      setDirty(true);
      return res.invoice;
    },
    [role, userName],
  );

  const canUseWarehouse = useCallback((w: WarehouseId) => role === "owner" || w === "kerdasa", [role]);

  /** بيطبّق عملية على البيانات الحالية ويحدّث الحالة — كل العمليات بتعدي من هنا */
  const userNameRef = useRef(userName);
  userNameRef.current = userName;

  const apply = useCallback(<T,>(fn: (current: DemoDataset, currentIx: Indexes) => { ds: DemoDataset; result: T }): T => {
    const current = dsRef.current;
    const currentIx = ixRef.current;
    if (!current || !currentIx) throw new Error("البيانات لسه بتتحمّل");
    const out = fn(current, currentIx);
    const result = out.result;
    // كل حركة خزنة جديدة بتتختم باسم اللي عملها (سجل العمليات)
    const prevLen = current.cash.length;
    const next: DemoDataset =
      out.ds.cash.length > prevLen
        ? { ...out.ds, cash: out.ds.cash.map((t, i) => (i >= prevLen && !t.createdBy ? { ...t, createdBy: userNameRef.current } : t)) }
        : out.ds;
    dsRef.current = next;
    setDs(next);
    setDirty(true);
    return result;
  }, []);

  const createTransfer = useCallback(
    (draft: Omit<TransferDraft, "createdBy">): StockTransfer => {
      if (!canUseWarehouse(draft.fromWarehouseId)) throw new Error("مسموح لك تبعت من مخزن كرداسة بس.");
      return apply((cur, cix) => {
        const r = commitTransfer(cur, cix, { ...draft, createdBy: userName });
        return { ds: r.ds, result: r.transfer };
      });
    },
    [apply, canUseWarehouse, userName],
  );

  const receiveTransfer = useCallback(
    (id: string): StockTransfer => {
      const t = dsRef.current?.transfers.find((x) => x.id === id);
      if (t && !canUseWarehouse(t.toWarehouseId)) throw new Error("الاستلام بيتعمل من المخزن المستلم.");
      return apply((cur) => {
        const r = receiveTransferFn(cur, id, userName);
        return { ds: r.ds, result: r.transfer };
      });
    },
    [apply, canUseWarehouse, userName],
  );

  const transferCash = useCallback(
    (draft: Omit<CashTransferDraft, "createdBy">) => {
      if (role !== "owner") throw new Error("تحويل النقدية بين الخزن للمالك بس.");
      apply((cur) => ({ ds: commitCashTransfer(cur, { ...draft, createdBy: userName }), result: undefined }));
    },
    [apply, role, userName],
  );

  const recordCollection = useCallback(
    (draft: Omit<CollectionDraft, "createdBy">): CashTransaction => {
      if (!canUseWarehouse(draft.warehouseId)) throw new Error("مسموح لك تحصّل في خزنة كرداسة بس.");
      return apply((cur, cix) => {
        const r = commitCollection(cur, cix, { ...draft, createdBy: userName });
        return { ds: r.ds, result: r.tx };
      });
    },
    [apply, canUseWarehouse, userName],
  );

  const runPayroll = useCallback(
    (type: PayType, lines: PayrollLineInput[]): PayrollPayment[] => {
      if (role !== "owner") throw new Error("صرف القبضة للمالك بس.");
      return apply((cur) => {
        const r = commitPayroll(cur, { type, lines, createdBy: userName });
        return { ds: r.ds, result: r.payments };
      });
    },
    [apply, role, userName],
  );

  const giveAdvance = useCallback(
    (draft: Omit<AdvanceDraft, "createdBy">): SalaryAdvance => {
      if (role !== "owner") throw new Error("السلف للمالك بس.");
      return apply((cur) => {
        const r = commitAdvance(cur, { ...draft, createdBy: userName });
        return { ds: r.ds, result: r.advance };
      });
    },
    [apply, role, userName],
  );

  const createPurchase = useCallback(
    (draft: Omit<PurchaseDraft, "createdBy">): PurchaseInvoice => {
      if (!canUseWarehouse(draft.warehouseId)) throw new Error("مسموح لك تستلم في مخزن كرداسة بس.");
      return apply((cur, cix) => {
        const r = commitPurchase(cur, cix, { ...draft, createdBy: userName });
        return { ds: r.ds, result: r.invoice };
      });
    },
    [apply, canUseWarehouse, userName],
  );

  const paySupplier = useCallback(
    (draft: Omit<SupplierPaymentDraft, "createdBy">) => {
      if (role !== "owner") throw new Error("سداد الموردين للمالك بس.");
      apply((cur) => ({ ds: commitSupplierPayment(cur, { ...draft, createdBy: userName }), result: undefined }));
    },
    [apply, role, userName],
  );

  const addExpense = useCallback(
    (d: { warehouseId: WarehouseId; amount: number; category: string; note: string }) => {
      if (!canUseWarehouse(d.warehouseId)) throw new Error("مسموح لك تسجّل مصروف من خزنة كرداسة بس.");
      apply((cur) => ({ ds: commitExpense(cur, { ...d, createdBy: userName }), result: undefined }));
    },
    [apply, canUseWarehouse, userName],
  );

  const closeCashDay = useCallback(
    (d: { warehouseId: WarehouseId; counted: number; note: string }): CashClosing => {
      if (!canUseWarehouse(d.warehouseId)) throw new Error("مسموح لك تقفل خزنة كرداسة بس.");
      return apply((cur) => {
        const r = commitClosing(cur, { ...d, closedBy: userName });
        return { ds: r.ds, result: r.closing };
      });
    },
    [apply, canUseWarehouse, userName],
  );

  const updateItemPrice = useCallback(
    (itemId: string, salePrice: number) => {
      if (role !== "owner") throw new Error("تعديل الأسعار للمالك بس.");
      if (!(salePrice > 0)) throw new Error("السعر لازم يكون أكبر من صفر.");
      apply((cur) => ({ ds: { ...cur, items: cur.items.map((i) => (i.id === itemId ? { ...i, salePrice } : i)) }, result: undefined }));
    },
    [apply, role],
  );

  const newInvoiceFor = useCallback((customerId: string | null) => {
    setInvoiceCustomerIntent(customerId);
    if (customerId) {
      setOpenCustomerId(null);
      setView("sales_new");
    }
  }, []);

  const resetDemo = useCallback(() => {
    setDs(generateDataset(todayIso()));
    setDirty(false);
    setOpenInvoiceId(null);
    setOpenLot(null);
    setOpenCustomerId(null);
    setOpenEmployeeId(null);
    setOpenPurchaseId(null);
    setOpenSupplierId(null);
    notify("رجّعنا بيانات الديمو لأولها.");
  }, [notify]);

  const value = useMemo<DemoState | null>(() => {
    if (!ds || !ix) return null;
    return {
      ds,
      ix,
      view,
      setView,
      warehouse,
      setWarehouse,
      period,
      setPeriod,
      role,
      setRole,
      theme,
      setTheme: setThemeRaw,
      themeVersion,
      can: {
        seeProfit: role === "owner",
        seeAllWarehouses: role === "owner",
        exceedCreditLimit: role === "owner",
        transferCash: role === "owner",
        access: canUseWarehouse,
      },
      userName,
      createInvoice,
      createTransfer,
      receiveTransfer,
      transferCash,
      dirty,
      resetDemo,
      openInvoiceId,
      openInvoice: setOpenInvoiceId,
      openLot,
      setOpenLot,
      inventoryQuery,
      setInventoryQuery,
      openCustomerId,
      openCustomer: setOpenCustomerId,
      invoiceCustomerIntent,
      newInvoiceFor,
      recordCollection,
      runPayroll,
      giveAdvance,
      createPurchase,
      paySupplier,
      addExpense,
      closeCashDay,
      updateItemPrice,
      openSupplierId,
      openSupplier: setOpenSupplierId,
      openPurchaseId,
      openPurchase: setOpenPurchaseId,
      openEmployeeId,
      openEmployee: setOpenEmployeeId,
      toast,
      notify,
    };
  }, [ds, ix, view, warehouse, setWarehouse, period, role, setRole, theme, themeVersion, userName, createInvoice, createTransfer, receiveTransfer, transferCash, canUseWarehouse, dirty, resetDemo, openInvoiceId, openLot, inventoryQuery, openCustomerId, invoiceCustomerIntent, newInvoiceFor, recordCollection, runPayroll, giveAdvance, openEmployeeId, createPurchase, paySupplier, openPurchaseId, addExpense, closeCashDay, updateItemPrice, openSupplierId, toast, notify]);

  if (!value) return <BootScreen />;
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoState {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo لازم يتستخدم جوه DemoProvider");
  return ctx;
}

function BootScreen() {
  return (
    <div className="boot" role="status" aria-live="polite">
      <div className="boot__tiles" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <p>جاري تجهيز بيانات أبو سعدة…</p>
    </div>
  );
}
