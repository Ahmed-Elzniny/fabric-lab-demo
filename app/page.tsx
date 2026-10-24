// app/page.tsx
// الديمو تطبيق صفحة واحدة (SPA) والتنقل بين الشاشات جوه DemoApp،
// عشان نفس الكود يشتغل في Next.js وفي نسخة العرض المجمّعة (Artifact).
import DemoApp from "@/DemoApp";

export default function Page() {
  return <DemoApp />;
}
