// scripts/build-site.mjs
// بيبني الديمو كموقع ثابت منظم للرفع على GitHub Pages أو أي استضافة:
//   site/index.html        الصفحة
//   site/css/style.css     كل التنسيقات
//   site/js/app.js         كود التطبيق (React + الشاشات + البيانات)
//   site/assets/*.svg      لوجوهات نظّام
// الاستخدام: npm run build:site
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "site");
rmSync(out, { recursive: true, force: true });
mkdirSync(resolve(out, "css"), { recursive: true });
mkdirSync(resolve(out, "js"), { recursive: true });

const common = {
  bundle: true,
  target: ["es2020"],
  logLevel: "warning",
  legalComments: "none",
};

// 1) الجافاسكربت: متصغّر (Minified) عشان التحميل يبقى سريع على الموبايل
await build({
  ...common,
  entryPoints: [resolve(root, "demo/entry.tsx")],
  outfile: resolve(out, "js/app.js"),
  minify: true,
  format: "iife",
  jsx: "automatic",
  alias: { "@": resolve(root, "src") },
  define: { "process.env.NODE_ENV": '"production"' },
  logOverride: { "unsupported-directive": "silent" },
  // الـ CSS اللي بيستورده entry.tsx بيطلع جنبه — بنحذفه ونبني الـ CSS لوحده تحت
  write: true,
});
rmSync(resolve(out, "js/app.css"), { force: true });

// 2) الـ CSS: ملف واحد مقروء (مش متصغّر) بنفس ترتيب الاستيراد
const cssEntry = resolve(out, "_styles.css");
writeFileSync(
  cssEntry,
  ["globals", "sales", "transfers", "inventory", "customers", "workforce", "purchases", "reports", "admin"]
    .map((n) => `@import "${resolve(root, "src/styles", `${n}.css`).replace(/\\/g, "/")}";`)
    .join("\n"),
);
await build({ ...common, entryPoints: [cssEntry], outfile: resolve(out, "css/style.css"), minify: false });
rmSync(cssEntry, { force: true });

// 3) اللوجوهات
cpSync(resolve(root, "public/brand"), resolve(out, "assets"), { recursive: true });

// 4) الصفحة
const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#0E1726">
  <title>أبو سعدة للأقمشة — Nazzam Fabric</title>
  <meta name="description" content="نسخة عرض لنظام إدارة تجارة الأقمشة بالجملة لمخزني كرداسة والمحلة — من نظّام">
  <link rel="icon" type="image/svg+xml" href="assets/nazzam-mark-on-light.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div id="root"></div>
  <noscript>الديمو محتاج JavaScript يكون شغال في المتصفح.</noscript>
  <script src="js/app.js" defer></script>
</body>
</html>
`;
writeFileSync(resolve(out, "index.html"), html);
writeFileSync(resolve(out, ".nojekyll"), "");

const kb = (p) => `${(statSync(resolve(out, p)).size / 1024).toFixed(0)} KB`;
console.log(`site/index.html    ${kb("index.html")}`);
console.log(`site/css/style.css ${kb("css/style.css")}`);
console.log(`site/js/app.js     ${kb("js/app.js")}`);
