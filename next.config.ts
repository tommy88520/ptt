import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AWS 時期的網域，已經貼在 blog footer、履歷等地方，舊連結轉到新網域
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "ptt-alert.huangyanming.com" }],
        destination: "https://ptt.huangyanming.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
