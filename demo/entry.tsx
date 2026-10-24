// demo/entry.tsx
// مدخل نسخة العرض المجمّعة (Artifact): نفس كود التطبيق بالظبط، متجمّع في صفحة HTML واحدة.
import { createRoot } from "react-dom/client";
import "../src/styles/globals.css";
import "../src/styles/sales.css";
import "../src/styles/transfers.css";
import "../src/styles/inventory.css";
import "../src/styles/customers.css";
import "../src/styles/workforce.css";
import "../src/styles/purchases.css";
import "../src/styles/reports.css";
import "../src/styles/admin.css";
import DemoApp from "../src/DemoApp";

const el = document.getElementById("root");
if (el) createRoot(el).render(<DemoApp />);
