import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deploy en VPS vía Docker (no Vercel): standalone genera un servidor
  // Node autocontenido en .next/standalone, ideal para la imagen Docker.
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
