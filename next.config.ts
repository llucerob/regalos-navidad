import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los documentos se suben directo a Supabase Storage (URL firmada), por lo que
  // no dependemos del límite de tamaño de las Server Actions.
  poweredByHeader: false,
  serverExternalPackages: ["nodemailer", "exceljs"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
