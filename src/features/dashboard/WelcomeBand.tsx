// src/features/dashboard/WelcomeBand.tsx
"use client";

import { ArrowLeftRight, BellRing, PackagePlus, Plus, Receipt, Truck } from "lucide-react";
import { RollIcon } from "@/components/ui/RollIcon";
import { BUSINESS } from "@/data/catalog";
import { fmtFullDate, fmtInt } from "@/lib/format";
import type { Role, ViewId } from "@/store/DemoProvider";

interface Props {
  today: string;
  role: Role;
  invoicesToday: number;
  rollsToday: number;
  inTransit: number;
  urgent: number;
  go: (v: ViewId) => void;
}

// شبكة الهوية (Grid motif) على الطرف الشمال — عمودين
const TILES = ["t", "", "", "w", "", "t", "w", ""];

export function WelcomeBand({ today, role, invoicesToday, rollsToday, inTransit, urgent, go }: Props) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "صباح الخير" : "مساء الخير";
  const who = role === "owner" ? BUSINESS.owner : "محمود";

  return (
    <section className="welcome" aria-label="ملخص اليوم">
      <div className="welcome__text">
        <p className="welcome__date">{fmtFullDate(today)}</p>
        <h2>
          {greeting} يا {who} — <em>حساباتك كلها</em> في شاشة واحدة
        </h2>
        <ul className="welcome__facts">
          <li>
            <Receipt size={15} aria-hidden="true" />
            <b className="num">{fmtInt(invoicesToday)}</b> فاتورة بيع النهارده
          </li>
          <li>
            <RollIcon size={15} />
            <b className="num">{fmtInt(rollsToday)}</b> توب خرج
          </li>
          <li>
            <Truck size={15} aria-hidden="true" />
            <b className="num">{fmtInt(inTransit)}</b> تحويل في الطريق
          </li>
          <li>
            <BellRing size={15} aria-hidden="true" />
            <b className="num">{fmtInt(urgent)}</b> تنبيه عاجل
          </li>
        </ul>
      </div>
      <div className="welcome__actions">
        <button type="button" className="btn btn--primary" onClick={() => go("sales_new")}>
          <Plus size={16} aria-hidden="true" /> فاتورة بيع جديدة
        </button>
        <button type="button" className="btn btn--ghost-dark" onClick={() => go("purchases_new")}>
          <PackagePlus size={16} aria-hidden="true" /> استلام بضاعة
        </button>
        <button type="button" className="btn btn--ghost-dark" onClick={() => go("transfers_new")}>
          <ArrowLeftRight size={16} aria-hidden="true" /> تحويل بين المخازن
        </button>
      </div>
      <div className="welcome__grid" aria-hidden="true">
        {TILES.map((t, i) => (
          <span key={i} className={t} />
        ))}
      </div>
    </section>
  );
}
