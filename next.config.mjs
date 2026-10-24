// next.config.mjs
// الديمو Frontend فقط: بنصدّره كموقع ثابت (Static Export) يترفع على أي سيرفر أو CDN.
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
};

export default nextConfig;
