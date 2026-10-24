// app/layout.tsx
import type { Metadata, Viewport } from "next";
import "../src/styles/globals.css";
import "../src/styles/sales.css";
import "../src/styles/transfers.css";
import "../src/styles/inventory.css";
import "../src/styles/customers.css";
import "../src/styles/workforce.css";
import "../src/styles/purchases.css";
import "../src/styles/reports.css";
import "../src/styles/admin.css";

export const metadata: Metadata = {
  title: "أبو سعدة للأقمشة — Nazzam Fabric",
  description: "نظام إدارة تجارة الأقمشة بالجملة لمخزني كرداسة والمحلة — ديمو من نظّام",
  icons: { icon: "/brand/nazzam-mark-on-light.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0E1726",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
