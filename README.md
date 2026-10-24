# Nazzam Fabric — ديمو أبو سعدة للأقمشة

نسخة عرض (Frontend Demo) لنظام إدارة تجارة الأقمشة بالجملة لتاجر عنده مخزنين: **كرداسة** و**المحلة**، كل مخزن بيشتري ويبيع وله خزنة منفصلة. البيع بالتوب، والعميل بياخد الصنف بتشكيلة ألوانه.

## التشغيل

```bash
npm install
npm run dev              # بيئة التطوير على http://localhost:3000
npm run build            # تصدير ثابت (Static Export) في مجلد out/
npm run start            # تشغيل نسخة out/ محلياً
npm run build:site       # موقع منظم في site/ (index.html + css/ + js/ + assets/) للنشر
npm run build:artifact   # صفحة HTML واحدة مستقلة في dist/abu-saada-demo.html
npm run typecheck        # فحص TypeScript
```

## البنية (Structure)

| المسار | الوظيفة |
|---|---|
| `app/layout.tsx`, `app/page.tsx` | صفحة Next.js (RTL + خط IBM Plex Sans Arabic) |
| `src/DemoApp.tsx` | هيكل التطبيق والتنقل بين الشاشات |
| `src/store/DemoProvider.tsx` | الحالة العامة: الفلاتر، المستخدم والصلاحيات، الثيم |
| `src/data/types.ts` | أنواع البيانات بنفس شكل DRF API المستقبلي |
| `src/data/catalog.ts` | المخازن، الأصناف، الألوان، العملاء، الموردين، العمالة |
| `src/data/generate.ts` | محاكاة 180 يوم شغل (مشتريات، بيع بالتشكيلة، تحصيل، تحويلات، خزن، مرتبات وسلف) |
| `src/data/selectors.ts` | حسابات لوحة التحكم (هتتنقل لـ Django كـ endpoints) |
| `src/data/sales.ts` | فاتورة البيع بالألوان والطبخات |
| `src/data/transfers.ts` | التحويلات بين المخازن وتحويل النقدية |
| `src/data/inventory.ts` | المخزون بالطبخة والتوب والبحث بالكود |
| `src/data/customers.ts` | كشف حساب العميل وأعمار الديون والتحصيل |
| `src/data/workforce.ts` | صرف القبضة والسلف وكشف الموظف |
| `src/data/purchases.ts` | استلام البضاعة وتوزيع مصاريف النقل وأرصدة الموردين |
| `src/data/reports.ts` | الأرباح والخسائر، الربح بالصنف والعميل، حركة الأصناف واقتراح الشراء، الراكد، حركة الخزن |
| `src/data/cashbook.ts` | يومية الخزنة والمصروفات وتقفيل اليومية |
| `src/data/activity.ts` | سجل العمليات (مين عمل إيه) |
| `src/features/*` | الشاشات: dashboard, inventory, sales, purchases, transfers, customers, suppliers, cash, workforce, reports, settings |
| `src/features/dashboard/*` | كروت لوحة التحكم |
| `src/features/placeholder/ComingSoon.tsx` | عناوين الشاشات (VIEW_META) + شاشة احتياطية |
| `src/styles/globals.css` | هوية نظّام: الألوان، الوضع الغامق، الشبكة، الموبايل |
| `scripts/build-site.mjs` | بناء الموقع المنظم للنشر (site/) |
| `scripts/build-artifact.mjs` | تجميع الديمو في ملف HTML واحد |
| `.github/workflows/deploy-pages.yml` | نشر تلقائي على GitHub Pages مع كل push على main |

## ملاحظات

- البيانات وهمية بالكامل ومولّدة على جهاز المستخدم بتاريخ النهارده، بنفس الـ Seed، فالأرقام مترابطة: المخزون = المشتريات − المبيعات ± التحويلات، والخزنة = الافتتاحي + الوارد − المنصرف.
- الجمعة إجازة، والأسبوعيات بتتقبض الخميس، والمرتبات أول الشهر، والسلف بتتخصم على أقساط.
- الصلاحيات في الديمو على مستوى الواجهة بس؛ في النسخة الحقيقية الـ API هو اللي بيمنع البيانات حسب المستخدم والمخزن.
- لوني المخزنين متحقق منهم لعمى الألوان (Color Vision Deficiency) في الوضعين الفاتح والغامق.

## النشر على GitHub Pages

1. ارفع المشروع على GitHub (فرع `main`).
2. من **Settings ← Pages** اختار **Source: GitHub Actions**.
3. كل push بيبني الموقع وينشره على `https://USERNAME.github.io/REPO/`.
