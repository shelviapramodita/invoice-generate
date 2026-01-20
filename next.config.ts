import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empty turbopack config to silence warning
  turbopack: {},
  
  // Server-side only imports for PDF generation
  serverExternalPackages: ['@react-pdf/renderer', 'canvas'],
};

export default nextConfig;
