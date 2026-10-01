import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Cursor Try Live / desktop proxy hosts to load Next.js dev assets.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.cursor.com",
    "*.cursor.sh",
    "*.cursorapi.com",
  ],
};

export default nextConfig;
