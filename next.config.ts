import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },

  async redirects() {
    return [
      {
        source: "/admin/attendance/sessions",
        destination: "/admin/calendar",
        permanent: true,
      },
    ];
  },

  async rewrites() {
    const apiUrl =
      process.env.GOALIX_INTERNAL_API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://127.0.0.1:3000";
    return [
      {
        source: "/uploads/:path*",
        destination: `${apiUrl.replace(/\/$/, "")}/uploads/:path*`,
      },
    ];
  },

  async headers() {
    const baseHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];

    if (process.env.NODE_ENV !== "development") {
      baseHeaders.push({
        key: "Permissions-Policy",
        value: "camera=(self), microphone=(), geolocation=()",
      });
    }

    return [
      {
        source: "/:path*",
        headers: baseHeaders,
      },
    ];
  },
};

export default nextConfig;
