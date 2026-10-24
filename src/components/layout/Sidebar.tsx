// src/components/layout/Sidebar.tsx
"use client";

import {
  ArrowLeftRight,
  BarChart3,
  Factory,
  HardHat,
  RotateCcw,
  LayoutDashboard,
  PackagePlus,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { BUSINESS } from "@/data/catalog";
import { LOGO_HORIZONTAL_ON_DARK } from "@/brand/logos";
import { RollIcon } from "@/components/ui/RollIcon";
import { useDemo, type Role, type ViewId } from "@/store/DemoProvider";

interface NavEntry {
  id: ViewId;
  label: string;
  icon: ReactNode;
  ownerOnly?: boolean;
}

const NAV_GROUPS: { label: string; items: NavEntry[] }[] = [
  {
    label: "الرئيسية",
    items: [{ id: "dashboard", label: "لوحة التحكم", icon: <LayoutDashboard size={18} /> }],
  },
  {
    label: "البضاعة",
    items: [
      { id: "inventory", label: "المخزون والطبخات", icon: <RollIcon size={18} /> },
      { id: "sales", label: "فواتير البيع", icon: <Receipt size={18} /> },
      { id: "purchases", label: "المشتريات", icon: <PackagePlus size={18} /> },
      { id: "transfers", label: "التحويلات بين المخازن", icon: <ArrowLeftRight size={18} /> },
    ],
  },
  {
    label: "الحسابات",
    items: [
      { id: "customers", label: "العملاء", icon: <Users size={18} /> },
      { id: "suppliers", label: "الموردين", icon: <Factory size={18} />, ownerOnly: true },
      { id: "cash", label: "الخزن", icon: <Wallet size={18} /> },
      { id: "workforce", label: "العمالة والمرتبات", icon: <HardHat size={18} />, ownerOnly: true },
      { id: "reports", label: "التقارير", icon: <BarChart3 size={18} />, ownerOnly: true },
    ],
  },
  {
    label: "النظام",
    items: [{ id: "settings", label: "الإعدادات والصلاحيات", icon: <Settings size={18} />, ownerOnly: true }],
  },
];

interface SidebarProps {
  inTransitCount: number;
  onNavigate: () => void;
}

export function Sidebar({ inTransitCount, onNavigate }: SidebarProps) {
  const { view, setView, role, setRole, dirty, resetDemo } = useDemo();

  const go = (id: ViewId) => {
    setView(id);
    onNavigate();
  };

  return (
    <aside className="sidebar" aria-label="القائمة الرئيسية">
      <div className="sidebar__brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="sidebar__logo" src={LOGO_HORIZONTAL_ON_DARK} alt="نظّام" width={128} height={63} />
        <div className="tenant">
          <span className="tenant__badge" aria-hidden="true">
            {BUSINESS.initials}
          </span>
          <div>
            <div className="tenant__name">{BUSINESS.name}</div>
            <div className="tenant__sub">مخزن كرداسة · مخزن المحلة</div>
          </div>
        </div>
      </div>

      <nav className="nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="nav__label">{group.label}</div>
            {group.items.map((item) => {
              const locked = item.ownerOnly && role !== "owner";
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nav__item ${locked ? "nav__item--locked" : ""}`}
                  aria-current={view === item.id || view === `${item.id}_new` ? "page" : undefined}
                  aria-disabled={locked || undefined}
                  title={locked ? "الشاشة دي للمالك بس" : undefined}
                  onClick={() => !locked && go(item.id)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.id === "transfers" && inTransitCount > 0 && (
                    <span className="nav__count num" aria-label={`${inTransitCount} في الطريق`}>
                      {inTransitCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar__foot">
        <div className="role-card">
          <div className="role-card__title">
            <ShieldCheck size={14} aria-hidden="true" />
            جرّب الصلاحيات: ادخل بصفة
          </div>
          <div className="role-switch" role="group" aria-label="المستخدم الحالي">
            {(
              [
                ["owner", "المالك"],
                ["storekeeper", "أمين مخزن كرداسة"],
              ] as [Role, string][]
            ).map(([r, label]) => (
              <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)}>
                {label}
              </button>
            ))}
          </div>
          <p className="role-card__hint">
            {role === "owner"
              ? "الحاج أبو سعدة شايف المخزنين والخزنتين والأرباح والمرتبات."
              : "محمود (أمين المخزن) شايف كرداسة بس، من غير أرباح ولا مرتبات ولا خزنة المحلة."}
          </p>
        </div>
        {dirty && (
          <button type="button" className="reset-btn" onClick={resetDemo}>
            <RotateCcw size={14} aria-hidden="true" /> رجّع بيانات الديمو لأولها
          </button>
        )}
        <div className="powered">Nazzam Fabric · نسخة عرض</div>
      </div>
    </aside>
  );
}
