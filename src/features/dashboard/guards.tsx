// src/features/dashboard/guards.tsx
// بيعرض المحتوى حسب صلاحية المستخدم. في النسخة الحقيقية الـ API نفسه هيمنع البيانات (مش الواجهة بس).
import type { ReactNode } from "react";

export function RoleGuard({ allowed, locked, children }: { allowed: boolean; locked: ReactNode; children: ReactNode }) {
  return <>{allowed ? children : locked}</>;
}
