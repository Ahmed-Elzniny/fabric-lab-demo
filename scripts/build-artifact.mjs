// scripts/build-artifact.mjs
// بيجمّع الديمو في ملف HTML واحد مستقل (CSS وJS جوه الصفحة) للعرض كرابط على claude.ai
// أو لفتحه من غير سيرفر. الاستخدام: npm run build:artifact
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "dist");
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [resolve(root, "demo/entry.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  jsx: "automatic",
  outdir: outDir,
  entryNames: "bundle",
  alias: { "@": resolve(root, "src") },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
  logOverride: { "unsupported-directive": "silent" },
  legalComments: "none",
});

const css = readFileSync(resolve(outDir, "bundle.css"), "utf8");
// "</script" جوه الـ JS يقفل التاج بدري — بنهرّبه
const js = readFileSync(resolve(outDir, "bundle.js"), "utf8").replace(/<\/script/gi, "<\\/script");

const html = `<title>ديمو أبو سعدة للأقمشة</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Nazzam Fabric — نسخة عرض لإدارة تجارة الأقمشة بالجملة لمخزني كرداسة والمحلة">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap">
<style>${css}</style>
<div id="root" dir="rtl" lang="ar"></div>
<script>document.documentElement.setAttribute("dir","rtl");document.documentElement.setAttribute("lang","ar");</script>
<script>${js}</script>
`;
writeFileSync(resolve(outDir, "abu-saada-demo.html"), html);
console.log(`dist/abu-saada-demo.html — ${(html.length / 1024).toFixed(0)} KB`);
